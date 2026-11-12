// Google Apps Script backend for scripts/create-email-draft.mjs.
// Creates a Gmail draft only. Sending is manual.
//
// Paste this file into the existing Apps Script project, then update the
// existing web app deployment to a New version (Execute as Me).
// Keep the existing TOKEN Script Property.
// If you copied the former appsscript.json with explicit oauthScopes, remove
// that oauthScopes entry so Apps Script can infer the original GmailApp scope.

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (_) {
    return json({ error: "invalid JSON" });
  }

  const token = PropertiesService.getScriptProperties().getProperty("TOKEN");
  if (!token || req.token !== token) {
    return json({ error: "invalid token" });
  }
  if (!req.to || !req.subject || !req.text || !req.html) {
    return json({ error: "missing draft fields" });
  }

  const options = { htmlBody: req.html };
  if (req.bcc) options.bcc = req.bcc;
  const draft = GmailApp.createDraft(req.to, req.subject, req.text, options);
  return json({ draftId: draft.getId() });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
