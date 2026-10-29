using System;
using System.Collections;
using UnityEngine;
using UnityEngine.Networking;
using MRBoardMVP;

// Optional adapter. Does not replace Living Table's chess/duel rules or scenes.
// Wire confirmed observations to Observe(); the host approves them in Frenemies.
public sealed class FrenemiesTerritoryBridge : MonoBehaviour
{
    [Serializable] public sealed class Figure { public string id, toyId, art, location; public bool infected, equipped; public int units; }
    [Serializable] public sealed class Snapshot { public string protocol; public int revision; public GameDefinition definition; public Figure[] figures; }
    [Serializable] public sealed class Observation { public string pieceId, target; public int revision; }
    [Serializable] public sealed class Artwork { public string art; public Sprite sprite; }
    public MRBoardPlatform platform;
    public string readOnlyStateUrl;
    public string observationUrl;
    public Artwork[] c2gArtwork;
    // Runtime-only: never serialize or commit a pairing credential in the scene.
    [NonSerialized] public string pairingKey;
    public string Status { get; private set; } = "Disconnected";
    public event Action<Snapshot> StateApplied;
    int revision = -1;
    bool observing;
    IEnumerator Start()
    {
        while (enabled)
        {
            if (platform != null && !string.IsNullOrWhiteSpace(readOnlyStateUrl))
            {
                using (var request = UnityWebRequest.Get(readOnlyStateUrl))
                {
                    request.timeout = 20;
                    yield return request.SendWebRequest();
                    if (request.result == UnityWebRequest.Result.Success)
                    {
                        var snapshot = JsonUtility.FromJson<Snapshot>(request.downloadHandler.text);
                        if (snapshot != null && snapshot.protocol == "c2g.territory.v1" && snapshot.revision != revision)
                        {
                            bool assetsReady = true;
                            foreach (var figure in snapshot.figures)
                                if (!string.IsNullOrEmpty(figure.location) && FindArt(figure.art) == null) assetsReady = false;
                            if (!assetsReady) Status = "Assign the supplied C2G sprites before displaying the board.";
                            else if (platform.board != null && !platform.board.IsAnimating)
                            {
                                snapshot.definition.Validate();
                                // Bypass registry re-registration; Build accepts a validated GameDefinition.
                                platform.board.Build(snapshot.definition);
                                // Do not permit unvalidated local moves. Observe() proposes, server confirms.
                                platform.board.MoveValidator = (id, from, to) => false;
                                platform.allowDesktopInput = false;
                                foreach (var view in platform.board.GetComponentsInChildren<PieceView>())
                                {
                                    var figure = Array.Find(snapshot.figures, f => f.toyId == view.id);
                                    if (figure == null) continue;
                                    view.visual.enabled = false;
                                    var visual = new GameObject("C2G " + figure.id);
                                    visual.transform.SetParent(view.transform, false);
                                    // Cancel the existing primitive scale, preserving original sprite proportions.
                                    visual.transform.localScale = new Vector3(1 / view.transform.localScale.x, 1 / view.transform.localScale.y, 1 / view.transform.localScale.z);
                                    var sprite = visual.AddComponent<SpriteRenderer>(); sprite.sprite = FindArt(figure.art);
                                    visual.transform.localScale *= snapshot.definition.cellSize * .85f / sprite.sprite.bounds.size.y;
                                }
                                revision = snapshot.revision; Status = "Synchronized revision " + revision;
                                StateApplied?.Invoke(snapshot);
                            }
                        }
                    }
                    else Status = "Connection unavailable; last board retained.";
                }
            }
            yield return new WaitForSecondsRealtime(1.5f);
        }
    }
    Sprite FindArt(string id) { foreach (var entry in c2gArtwork ?? Array.Empty<Artwork>()) if (entry.art == id) return entry.sprite; return null; }
    // Coordinate contract: Unity y=0 is Human/near edge; UI row 3.
    public void Observe(string stableToyIdOrTag, int column, int row)
    {
        if (observing || revision < 0 || column < 0 || column > 3 || row < 0 || row > 2 || string.IsNullOrEmpty(pairingKey)) return;
        StartCoroutine(SendObservation(new Observation {pieceId=stableToyIdOrTag, target=((char)('A'+column)).ToString()+(3-row), revision=revision}));
    }
    IEnumerator SendObservation(Observation observation)
    {
        observing = true;
        using (var request = new UnityWebRequest(observationUrl, "POST"))
        {
            request.uploadHandler = new UploadHandlerRaw(System.Text.Encoding.UTF8.GetBytes(JsonUtility.ToJson(observation)));
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            request.SetRequestHeader("Authorization", "Bearer " + pairingKey);
            request.timeout = 20;
            yield return request.SendWebRequest();
            Status = request.result == UnityWebRequest.Result.Success ? "Observed move submitted; await host confirmation." : "Observation refused; refresh state before trying again.";
        }
        observing = false;
    }
}
