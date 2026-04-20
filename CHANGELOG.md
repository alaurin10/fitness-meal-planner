# Changelog

## [Unreleased]

### Changed

- Migrate AI provider from Anthropic (Claude) to Google Gemini (`gemini-2.5-flash`)
- Replace `@anthropic-ai/sdk` with `@google/genai` in server dependencies
- Rename environment variable `ANTHROPIC_API_KEY` → `GEMINI_API_KEY`
- Enable Gemini JSON mode (`responseMimeType: "application/json"`) for more reliable structured output
