---
"grist-widget-sdk": minor
---

`parseDeployPath()` knows the widget catalog's paths: a release at `/<version>/`, and the newest release of a major at `/v<major>/`, a new channel `{ kind: "major", major }` (`deployChannelLabel()` gives `"v1"`). A `versions.json` entry may say where its release is served (`path`), and the default release page then links each major's channel and each release there. On `/dev/` the default release page no longer offers its URL to paste into Grist: it says the build follows every change before its release, and to use a released channel instead.

A widget that switches over `DeployChannel`'s `kind` gets a `"major"` case to handle; nothing else changes for existing widgets.
