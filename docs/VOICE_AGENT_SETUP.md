# Voice agent setup (ElevenLabs dashboard)

If the agent says it "cannot access the assessment questions", the client tools are missing or
misnamed in the dashboard. The app registers ten tools in the browser; the agent can only call a
tool that is defined here with the **exact same name**.

For each tool below: Agent > Tools > Add tool > **Client**. Paste the name and description, add the
parameters, and turn on **Wait for response**. Use the system prompt in `docs/voice-agent-prompt.md`.

| Name | Description | Parameters |
|---|---|---|
| `get_current_question` | Get the current assessment question and its options. Call at the start and after each accepted answer. | none |
| `submit_answer` | Record the technician's answer to the current question. Pass their exact words. | `answer_text` (string, required): the technician's words verbatim |
| `repeat_question` | Get the current question again. | none |
| `go_back` | Undo the last answer and return the previous question. | none |
| `get_what_we_know` | Get the top assessed likelihoods so far, as percentages from the app. | none |
| `record_measurement` | Record a measurement the technician spoke. The app asks them to confirm. | `quantity` (string, required, one of `voc`, `isc`, `pmax`); `utterance` (string, required): the words they said |
| `confirm_measurement` | Save or discard the pending measurement after the technician confirms. | `confirmed` (boolean, required) |
| `navigate` | Move the app to a step if its prerequisites are met. | `target` (string, required, one of `identify`, `inspect`, `questions`, `diagnosis`, `decision`, `passport`) |
| `get_decision_summary` | Get the app's recommendation, confidence, value range and reason as sentences to read out. | none |
| `end_session` | End the voice session. | none |

## Checks
- Names are lower case with underscores, exactly as above.
- Every tool has **Wait for response** on.
- The agent is public (no authentication) and its allowed origins include `http://localhost:5173`.
- The agent ID in `.env` (`VITE_ELEVENLABS_AGENT_ID`) matches this agent. Restart the dev server after changing `.env`.
- Open an assessment's Questions step, press Start voice, and allow the microphone.
