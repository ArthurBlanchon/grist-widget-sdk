---
"grist-widget-sdk": patch
---

**Attachment URLs only take an attachment id.** `getAttachmentUrl()`, `fetchAttachmentBlob()` (and the helpers behind them) now refuse anything but a positive integer as the attachment id, before asking Grist for an access token: the id usually comes from a cell, and the URL built from it carries the document's token, so a crafted value (`"1/../tables"`) could otherwise aim it at another route of the same Grist. The token in the URL is now encoded too.

`grist-widget-sdk` no longer depends on `grain-rpc`, which nothing imported since the iframe transport was removed: one package fewer in every widget.
