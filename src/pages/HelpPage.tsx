import React from "react";
import "../App.css";

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="settings-form-section">
    <h3 style={{ marginTop: 0 }}>{title}</h3>
    {children}
  </div>
);

const HelpPage: React.FC = () => {
  const pageStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 20,
    height: "calc(100vh - 51px)",
    overflowY: "auto",
    backgroundColor: "var(--app-bg-color)",
  };

  return (
    <div style={pageStyle}>
      <h2 style={{ margin: 0 }}>Help & Setup Guide</h2>

      <Section title="What this app does">
        <p>
          ProAssist is an intelligent bridge between your notes and
          ProPresenter. It simplifies importing slides by turning raw text into
          slide‑ready content, optionally using regex/JavaScript or AI‑powered
          processing. When you click Go Live, ProAssist writes one line per file
          that ProPresenter reads via Linked Text—so going live is as simple as
          a single click.
        </p>
      </Section>

      <Section title="Quick start">
        <ol>
          <li>Open Settings → Manage Templates.</li>
          <li>Create or edit a template (pick a color and layouts).</li>
          <li>
            Set an <strong>Output Path</strong> and a
            <strong> File Name Prefix</strong>. Example:
            <code> /Users/you/ProPresenter/live/</code> and
            <code> sermon_</code>.
          </li>
          <li>Go back to Main → Import → paste or upload your text.</li>
          <li>Pick a template and click Process, then select an item.</li>
          <li>When ready, click Go Live on a slide.</li>
        </ol>
      </Section>

      <Section title="Templates 101">
        <ul>
          <li>
            <strong>Layouts</strong>: choose how many lines a slide shows (One,
            Two, Three, etc.). Go Live writes one file per line:
            <code> prefix1.txt</code>, <code>prefix2.txt</code>, …
          </li>
          <li>
            <strong>Logic / Notes</strong> field supports different ways to
            pre‑process text:
            <ul>
              <li>
                <strong>Regex</strong>: describe how to split or capture
                sections (e.g. by blank lines, headings). Keep it simple if
                you’re new to regex.
              </li>
              <li>
                <strong>JavaScript</strong>: you can provide a small snippet to
                transform text (e.g. split on "---").
              </li>
              <li>
                <strong>Process with AI</strong>: enable, pick provider/model,
                and add your prompt. The app will generate slides from your
                instructions.
              </li>
            </ul>
          </li>
          <li>
            <strong>Output Path</strong>: folder where the .txt files are
            written. The app creates the folder if missing.
          </li>
          <li>
            <strong>File Name Prefix</strong>: base name for each line file.
            Example: with prefix <code>sermon_</code>, files become
            <code> sermon_1.txt</code>, <code>sermon_2.txt</code>, …
          </li>
        </ul>
      </Section>

      <Section title="Connect to ProPresenter (Linked Text)">
        <ol>
          <li>Open ProPresenter and create a new presentation/slide.</li>
          <li>
            Add <strong>N</strong> text boxes for the slide layout you want
            (e.g. 3 boxes for a Three‑Line slide).
          </li>
          <li>
            For each text box: Format → Linked Text → choose{" "}
            <strong>File</strong>, then select the matching file from your
            template’s Output Path:
            <ul>
              <li>
                Top line → <code>prefix1.txt</code>
              </li>
              <li>
                Second line → <code>prefix2.txt</code>
              </li>
              <li>
                Third line → <code>prefix3.txt</code>
              </li>
            </ul>
          </li>
          <li>
            In ProAssist, click <strong>Go Live</strong> on a slide. The app
            writes the latest text to the files; ProPresenter will display the
            linked content instantly.
          </li>
        </ol>
      </Section>

      <Section title="Troubleshooting">
        <ul>
          <li>
            No text in ProPresenter? Check the Output Path folder for
            <code>prefix1.txt</code> etc., and verify Linked Text points to the
            same files.
          </li>
          <li>
            Wrong line showing? Confirm the slide’s layout and which text box
            links to <code>prefix1.txt</code>, <code>prefix2.txt</code>, …
          </li>
          <li>
            Nothing updates? Click Go Live again; verify you have write
            permission to the Output Path.
          </li>
        </ul>
      </Section>
    </div>
  );
};

export default HelpPage;
