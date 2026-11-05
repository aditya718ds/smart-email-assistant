# Smart Email Assistant

A complete local recreation of the project in [Faisal Memon / EmbarkX's tutorial](https://www.youtube.com/watch?v=hpiO9CKkKfU). Includes a Spring Boot backend, React reply studio, Gemini integration and a Chrome/Edge Gmail extension. This is a new implementation of the demonstrated workflow, with a redesigned UI and current dependencies; it is not the creator's original source archive.

## Build this source checkout first

This repository excludes compiled JARs, dependencies and private configuration.

1. Clone or download and extract the repository.
2. Install a JDK (Java 17–27) and Node.js with npm.
3. Copy `config.example.properties` to `config.properties`.
4. Run `BUILD.bat`. Internet is needed for dependencies and the initial build.
5. Run `START.bat`. After building, normal use needs Java only.

## Keep API keys private

Only the blank `config.example.properties` belongs in Git. `config.properties`, environment files, logs and ZIP backups are excluded by `.gitignore`. GitHub web uploads do not apply local Git ignore rules: never manually upload the private configuration. Never put keys in frontend or extension code. Revoke a key immediately if it was published.

## Run on Windows after building

1. Build the source checkout using the steps above.
2. Double-click **START.bat**. Your browser opens at <http://127.0.0.1:8080>.
3. Click **Meeting**, choose a tone, then click **Generate demo reply**.
4. Keep the terminal open while using the app. Press **Ctrl+C** in that terminal to stop it.

Requires Java 17–27. Java 27 was detected on the system used to build and test this delivery. The launcher searches JAVA_HOME, PATH and common installation directories. No administrator access, npm, database, Maven or IDE is needed for normal use. All Java dependencies and the React interface are inside `app/smart-email-assistant.jar`.

**Demo mode uses offline templates, not an AI model.** For genuine contextual AI replies, open **SETUP_GUIDE.html** and follow the Gemini setup. You need your own Gemini API key and internet connection. API access, pricing, quotas and available models depend on your Google account.

## Included files

| File or folder | Purpose |
| --- | --- |
| START.bat | Windows launcher; starts the app and opens your browser |
| SETUP_GUIDE.html | Printable offline setup and troubleshooting guide |
| config.example.properties | Blank template; copy to private config.properties locally |
| app/smart-email-assistant.jar | Precompiled executable application |
| extension/ | Load this folder as an unpacked Chrome or Edge extension |
| frontend/ | React source, reproducible npm lockfile and extension tests |
| backend/ | Java source, Maven project and backend tests |
| BUILD.bat | Rebuild the React interface and Java application from source |


## Enable Gemini

If Gemini is not responding, run **CHECK_GEMINI.bat** from this same project folder. It checks the effective configuration, lists available models and attempts a minimal generation request using your configured key. It never prints the key. Share only the reported HTTP/status/reason lines when asking for help. The checker uses a small API request; no email content is sent.

Create a key at <https://aistudio.google.com/apikey>. Edit `config.properties`:

```properties
assistant.mode=gemini
assistant.gemini.api-key=PASTE_YOUR_KEY_HERE
assistant.gemini.model=gemini-3.5-flash-lite
```

Save, stop the app, and launch again. Enter the key without quotes. If that model is unavailable to your account, use a model ID offered by AI Studio that supports `generateContent`. The default model was taken from Google's documentation on November 3, 2026. Never put a key in the React code or extension. Keep your configured file private.

When using environment variables instead, remove the matching lines from config.properties first, because those explicit file values override environment defaults. Set `ASSISTANT_MODE`, `GEMINI_API_KEY`, and optionally `GEMINI_MODEL` before running START.bat.

## Gmail extension

Start the app, visit `chrome://extensions` (or `edge://extensions`), enable Developer mode, choose **Load unpacked**, and select the `extension` folder. Reload Gmail, open a message and click Reply. Click **AI Reply** near the draft. Review the original email context, then generate. Edit the preview and insert it into an empty draft or copy it into an existing draft. Nothing is sent automatically.

The toolbar popup also works as a paste-and-generate tool, even if Gmail's changing page structure prevents button injection. No Gmail OAuth app or Gmail API project is required. Installing or using this extension is optional.

## Development

Install a JDK and Node.js LTS (with npm), then run BUILD.bat. The build script downloads verified Apache Maven 3.9.11 into `.tools/`, installs locked npm dependencies, builds React, runs extension tests and Java tests, then replaces the runnable JAR. Initial build needs internet.

Manual commands:

```text
cd frontend
npm ci
npm test
npm run build:extension
npm run build
cd ../backend
mvn clean verify
```

Copy `backend/target/smart-email-assistant.jar` to `app/` if building manually. Restart after changes. The source targets Java 17 bytecode. Spring Boot 4.1.2 serves the UI and REST API from the same origin. The Gemini connection uses Java's HTTP client and the documented REST API directly, rather than depending on the Spring AI SDK.

## API

`GET /api/status` reports mode, model and whether a key is configured; this is not a live key-validity or quota check.

`POST /api/email/generate`, JSON body:

```json
{"emailContent":"Can we schedule a meeting?","tone":"professional","instructions":"Ask for an agenda","senderName":"Aditya"}
```

Response: `{"reply":"...","mode":"demo or gemini","model":"..."}`. Errors use HTTP 400, 429, 502, 503 or 504 with `{"error":"..."}`. The email limit is 20,000 characters; notes 2,000; signature 80. Tone is professional, friendly or casual. Omitting tone defaults to professional.

## Privacy and scope

The app binds to 127.0.0.1 and does not save an email history. Gemini mode sends the submitted email, signature and notes to Google. Demo mode makes no AI request. The app does not read the inbox in the background or send mail. Review generated facts and replace placeholders. Gmail DOM selectors can change. The existing implementation passed 16 Java tests and 10 extension behavior tests. Live Gmail preview, Gemini generation and insertion into an unsent draft were checked. The complete BUILD.bat flow has not been tested on a fresh computer.

## References

- Tutorial: <https://www.youtube.com/watch?v=hpiO9CKkKfU>
- Creator's linked source: <https://github.com/EmbarkXOfficial/spring-ai-masters/tree/main/email-writer>
- Gemini API: <https://ai.google.dev/api/generate-content>
- Gemini keys: <https://aistudio.google.com/apikey>
- Spring Boot requirements: <https://docs.spring.io/spring-boot/system-requirements.html>
- Chrome extensions: <https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world>

External libraries retain their original licenses. Frontend license notices are included alongside the generated JavaScript. The creator and Google do not endorse this implementation.
