import type { ReactNode } from 'react'
import { REPO_URL } from '../links'
import { Link } from '../router'
import { Code, Demo, H2, Kbd, List, Note, P, Pre, Steps, Table } from './blocks'

export type DocPage = { slug: string; group: string; title: string; description: string; body: ReactNode }

const doc = (slug: string, group: string, title: string, description: string, body: ReactNode): DocPage => ({ slug, group, title, description, body })

export const pages: DocPage[] = [
  doc(
    '',
    'Start here',
    'What is Anvil',
    'A coding agent for VS Code that shows its work and waits for your approval.',
    <>
      <P>
        Anvil is a VS Code extension. You describe a change, and it finds the right files, edits them, runs your tests and shows you every line before it
        is saved. The agent itself runs on <a className="font-medium text-gray-900 underline underline-offset-4" href="https://trueforge.dev">TrueForge</a>, TrueFoundry’s open agent harness.
      </P>
      <Demo chapter="agent" caption="Anvil handling a multi-file task" />
      <H2>What makes it different</H2>
      <List
        items={[
          'You see the context. Each request shows the files Anvil picked, why, and how much of the budget they use.',
          'You approve every change. Edits open as a review in the editor; nothing is written until you keep it.',
          'It proves its work. The agent runs your tests and only says “done” when a check passed after its last edit.',
          'It keeps going. If a model fails, the next one in your chain takes over and the panel says why.',
        ]}
      />
      <H2>Where to go next</H2>
      <List
        items={[
          <><Link className="font-medium text-gray-900 underline underline-offset-4" to="/docs/getting-started">Getting started</Link>: install and run it in five minutes.</>,
          <><Link className="font-medium text-gray-900 underline underline-offset-4" to="/docs/inline-edit">Inline edit</Link>: the fastest way to change code.</>,
          <><Link className="font-medium text-gray-900 underline underline-offset-4" to="/docs/benchmarks">Benchmarks</Link>: the numbers behind the claims.</>,
        ]}
      />
    </>,
  ),
  doc(
    'getting-started',
    'Start here',
    'Getting started',
    'Install Anvil, connect a model, and make your first reviewed edit.',
    <>
      <H2>What you need</H2>
      <List items={['VS Code 1.95 or newer', 'Node.js 22.18 or newer, and git', 'A model: an API key for OpenAI, Anthropic or Gemini, or a local Ollama model']} />
      <H2>Install and run</H2>
      <Pre>{`git clone ${REPO_URL}.git anvil
cd anvil
npm install
npm run build
npm run harness     # starts TrueForge on port 8790, leave it running`}</Pre>
      <Steps
        items={[
          <>Open the <Code>anvil</Code> folder in VS Code and press <Kbd>F5</Kbd>. A second window opens with Anvil loaded.</>,
          <>Open any project in that window, then click the Anvil icon in the activity bar.</>,
          <>Open <b>Settings → Models → Add provider</b>, paste your API key and pick models. Put a primary and a fallback in the chain.</>,
          <>Select a function, press <Kbd>Ctrl+Alt+K</Kbd> and describe a change. Review the diff and keep it.</>,
        ]}
      />
      <Note>Prefer a packaged install? Run <Code>npm run package</Code> and install <Code>dist/anvil.vsix</Code> from the Extensions view.</Note>
      <H2>After you change Anvil’s code</H2>
      <P>
        Run <Code>npm run build</Code>, then press <Kbd>Ctrl+R</Kbd> in the second window. Restart with <Kbd>F5</Kbd> only when <Code>package.json</Code> changed.
      </P>
    </>,
  ),
  doc(
    'inline-edit',
    'Using Anvil',
    'Inline edit',
    'Change selected code right where it is, and approve each line.',
    <>
      <Demo chapter="edit" caption="Inline edit in helpers.py" />
      <Steps
        items={[
          <>Select the code. A small toolbar appears above it: <b>Edit</b>, <b>Ask</b> and <b>Add to chat</b>.</>,
          <>Choose <b>Edit</b> or press <Kbd>Ctrl+Alt+K</Kbd>. A box opens under the selection.</>,
          <>Type what you want and press <Kbd>Ctrl+Enter</Kbd>. The change appears in place, red for removed lines and green for added ones.</>,
          <>For each change pick <b>Accept</b>, <b>Reject</b> or <b>Keep both</b>. <b>Open diff</b> shows before and after side by side.</>,
          <>Not quite right? Type a follow-up in <b>Refine</b> to keep working on the same lines. Inline edits never clutter your chat.</>,
        ]}
      />
      <Table
        head={['Key', 'Action']}
        rows={[
          [<Kbd>Ctrl+Alt+K</Kbd>, 'Edit the selection'],
          [<Kbd>Ctrl+Alt+Y</Kbd>, 'Accept the change under the cursor'],
          [<Kbd>Ctrl+Alt+X</Kbd>, 'Reject the change under the cursor'],
          [<Kbd>Alt+F5</Kbd>, 'Jump to the next change (Shift for previous)'],
        ]}
      />
    </>,
  ),
  doc(
    'agent-mode',
    'Using Anvil',
    'Agent mode',
    'Hand off a whole task across several files.',
    <>
      <Demo chapter="agent" caption="Agent mode adding a CLI command" />
      <P>
        Describe the goal in the side panel. Anvil picks the context, then the agent reads, searches, edits and runs commands until the task is done. You
        can keep typing while it works: a note sent with <b>Steer</b> reaches it at its next step.
      </P>
      <H2>What you see</H2>
      <List
        items={[
          'The context footer under your message: the files picked, tinted by role, and the token budget. Click it for the reasons.',
          'A plan checklist and one row per step: read, search, edit, run.',
          'Commands ask first. Choose Allow, Allow for this session, or Deny. Common ones like pytest can run without asking.',
          'The edits tray above the input: every changed file with Open diff and Undo, plus Keep all and Discard all.',
        ]}
      />
      <H2>How it finishes</H2>
      <P>
        The agent ends by reporting what it changed. It can only call the result verified when a test or check ran after its last edit and passed. If it
        stops early, Anvil asks it once to test or explain.
      </P>
    </>,
  ),
  doc(
    'ask-mode',
    'Using Anvil',
    'Ask mode',
    'Questions about your code, with no edits.',
    <>
      <P>
        Switch the mode dropdown in the input from <b>Agent</b> to <b>Ask</b>. The agent can read and search but cannot edit files or run commands, so it is
        safe for questions like “how does the CLI find the app?”.
      </P>
      <P>
        Selecting code and choosing <b>Ask</b> from the toolbar, or pressing <Kbd>Ctrl+Alt+Q</Kbd>, attaches the selection and switches to Ask mode for you.
      </P>
    </>,
  ),
  doc(
    'context',
    'Using Anvil',
    'Context',
    'How Anvil decides what the model sees, and how you steer it.',
    <>
      <Demo film="context" caption="Opening the context footer" />
      <P>
        Before every request Anvil ranks each file in your repository on your machine. It looks at file paths, symbol names and docstrings, which files
        import which, which files usually change together, and what you have open. The best matches go into a compact context pack within a token budget
        (6,000 by default).
      </P>
      <H2>Steer it yourself</H2>
      <List
        items={[
          <>Type <Code>@</Code> to mention a file or symbol. Symbols work in every language VS Code understands.</>,
          <>Use <b>+</b> in the input to add a file, an image, the current selection or a skill.</>,
          <>Your current selection follows you into the chat as a dashed card. Pin it to collect selections from several files.</>,
          <>Rule files are read automatically: <Code>AGENTS.md</Code>, <Code>CLAUDE.md</Code>, <Code>.cursorrules</Code> and others.</>,
        ]}
      />
    </>,
  ),
  doc(
    'review-and-undo',
    'Using Anvil',
    'Review and undo',
    'Nothing is saved until you approve it, and anything can be rewound.',
    <>
      <Demo film="undo" caption="Reverting a message and its code" />
      <P>
        Every edit opens as a review in the editor. Keep what you like, reject the rest. The model is told exactly what you turned down and gets the
        current text as its new starting point.
      </P>
      <H2>Revert from any message</H2>
      <Table
        head={['Option', 'What happens']}
        rows={[
          ['Conversation only', 'Forget this message and the ones after it. Files stay as they are.'],
          ['Code only', 'Undo the edits from this message on. The chat stays.'],
          ['Conversation and code', 'Go back to the moment before you sent it.'],
        ]}
      />
      <P>
        Prefer speed? <b>Settings → Agent → Apply, review later</b> lets edits land at once, and you keep or undo them from the edits tray. Undo history
        survives a window reload.
      </P>
    </>,
  ),
  doc(
    'models',
    'Using Anvil',
    'Models and failover',
    'Add providers, build a fallback chain, and survive outages.',
    <>
      <Demo chapter="failover" caption="A failed model handing over" />
      <Steps
        items={[
          <>Open <b>Settings → Models → Add provider</b>. Pick one from TrueForge’s catalog and paste a key, or add any OpenAI-compatible endpoint such as Ollama.</>,
          <>Add or remove models on each provider. Your key stays stored in TrueForge.</>,
          <>Build the chain: the first healthy model runs each message, the rest wait behind it.</>,
        ]}
      />
      <P>
        When a model errors or sends nothing for 45 seconds, Anvil sorts the cause (rate limit, outage, bad key, timeout), retries once where that helps,
        rests the model for 60 seconds and hands the same request to the next one. The turn shows which model failed, why, and which took over.
      </P>
    </>,
  ),
  doc(
    'skills',
    'Using Anvil',
    'Skills',
    'Teach Anvil your team’s way of doing things.',
    <>
      <Demo film="skills" caption="Running a skill with /" />
      <P>
        A skill is a folder with a <Code>SKILL.md</Code> file: a short description of when to use it, then the steps. Anvil reads the same format as
        Claude Code, so existing skills work as they are.
      </P>
      <Pre>{`.anvil/skills/release-notes/SKILL.md
---
name: release-notes
description: Write release notes from the git log. Use when asked for release notes.
---
1. Read the git log since the last tag.
2. Group changes into Added, Fixed and Changed.`}</Pre>
      <List
        items={[
          <>Create one in <b>Settings → Skills → New skill</b>, for this project or for all your projects.</>,
          'The agent sees each skill’s name and description, and loads the full skill when your request matches.',
          <>Run one yourself by typing <Code>/</Code> at the start of a message.</>,
          'Turn skills on or off, open or delete them from the same settings page.',
        ]}
      />
    </>,
  ),
  doc(
    'mcp',
    'Using Anvil',
    'MCP servers',
    'Give the agent more tools, from docs search to your notes.',
    <>
      <Demo film="mcp" caption="Adding an Obsidian MCP server" />
      <Steps
        items={[
          <>Open <b>Settings → MCP → Add server</b>.</>,
          'Enter a name, the server URL, and an auth header if it needs one.',
          'Anvil registers it with TrueForge and tests it right away. You see the tool count, or the error.',
        ]}
      />
      <P>
        Enabled servers are available to the agent. Tools that change things still ask for approval, Ask mode only gets read-only tools, and inline edits
        never use them. A public server to try: <Code>https://mcp.deepwiki.com/mcp</Code>.
      </P>
    </>,
  ),
  doc(
    'settings',
    'Using Anvil',
    'Settings',
    'Everything you can change, in one place.',
    <Table
      head={['Tab', 'What you set']}
      rows={[
        ['General', 'TrueForge address, start TrueForge automatically, the selection toolbar, attaching the selection to chat'],
        ['Models', 'Providers and their models, the model chain, reasoning effort'],
        ['Agent', 'Review mode, commands that run without asking, steps per turn, command timeout, failover delay, context budget'],
        ['Skills', 'Create, enable, open and delete skills'],
        ['MCP', 'Add, test, enable and remove MCP servers'],
      ]}
    />,
  ),
  doc(
    'architecture',
    'Reference',
    'Architecture',
    'How Anvil and TrueForge split the work.',
    <>
      <Table
        head={['Part', 'Job']}
        rows={[
          ['TrueForge', 'Runs the agent loop: sessions, streaming, tool calls, approvals, subagents and compaction.'],
          ['Anvil context engine', 'Ranks files locally and builds the context pack for each request.'],
          ['Anvil tool server', 'Serves editor tools (search, read, edit, run) to TrueForge over MCP on your machine, with a fresh token each start.'],
          ['Anvil review', 'Turns each proposed edit into an in-editor review and reports your decisions back to the model.'],
          ['Anvil panel', 'The chat, context, history and settings you see in VS Code.'],
        ]}
      />
      <P>
        Edits are proposals. When the agent wants to write, TrueForge pauses for approval; Anvil applies the change in memory, opens the review, and
        answers with exactly the parts you kept.
      </P>
    </>,
  ),
  doc(
    'benchmarks',
    'Reference',
    'Benchmarks',
    'How we measured, on the real Flask 3.1.3 codebase.',
    <>
      <H2>Finding the right files</H2>
      <Table
        head={['Ranker', 'Right files in top 5', 'Ranking score (MRR, higher is better)']}
        rows={[
          ['Anvil', '96%', '0.85'],
          ['Keyword search (BM25)', '71%', '0.43'],
          ['File path only', '21%', '0.14'],
        ]}
      />
      <P>12 hand-labelled tasks. On 103 real Flask commits it had never seen, a right file landed in the top five 85% of the time, against 70% for keyword search.</P>
      <H2>Smaller context</H2>
      <P>The context pack averages 4.5k tokens against 42.7k for sending the same files whole: 89% less. Ranking a request takes about 6 ms.</P>
      <H2>Edits that land</H2>
      <P>Models often copy code with small slips: extra spaces, tabs, wrong indentation. Out of 198 such cases, Anvil applied 97.5% correctly, against 15.2% for exact matching, and put none in the wrong place.</P>
      <H2>An agent that finishes properly</H2>
      <Table
        head={['On the multi-file task', 'Before', 'After']}
        rows={[
          ['Ended with untested edits', '11 of 14', '0 of 14'],
          ['Finished with a passing check as proof', '0 of 14', '10 of 14'],
          ['Failed test runs per task', '3.1', '0.3'],
          ['Input tokens per task', '193k', '141k'],
        ]}
      />
      <P>Seven models, two runs each. Pass rates moved little; how the agent finishes changed a lot. Every benchmark reruns from the repository with one command.</P>
      <H2>Files for the fixed multi-file task</H2>
      <P>
        For the <Code>flask config</Code> task, with no files named, Anvil’s top three picks were <Code>src/flask/cli.py</Code>, <Code>tests/test_cli.py</Code> and{' '}
        <Code>docs/cli.rst</Code>: exactly the files the change needs. Keyword search had none of them in its top three. In every live run, each file the agent edited
        was in Anvil’s top five.
      </P>
      <H2>103 commits it never saw</H2>
      <Table
        head={['Measure', 'Anvil', 'Anvil before co-change', 'Keyword search (BM25)']}
        rows={[
          ['A right file in the top 5 (hit@5)', '0.854', '0.825', '0.699'],
          ['Every right file in the top 5 (all@5)', '0.515', '0.466', '0.369'],
          ['Ranking score (MRR)', '0.716', '0.699', '0.532'],
        ]}
      />
      <P>200 real Flask commits since 2021: the request is the commit message, the answer is the files it changed, and the index is built just before the commit. Tuned on half, reported on the other 103. Co-change ranks files that usually change together in git history.</P>
      <H2>Edits, by kind of slip</H2>
      <Table
        head={['Slip in the model’s copy', 'Exact match', 'Anvil']}
        rows={[
          ['None', '100%', '100%'],
          ['Trailing spaces', '0%', '100%'],
          ['Tabs instead of spaces', '0%', '100%'],
          ['Wrong indentation', '0%', '100%'],
          ['Windows line endings', '0%', '100%'],
          ['Missing blank line', '0%', '100%'],
          ['One-character typo', '0%', '83.3%'],
        ]}
      />
      <P>In 60 traps where the target code was deleted and only similar functions remained, Anvil edited the wrong place 0 times. It refuses and shows the closest lines instead.</P>
      <H2>Stop, undo and failover</H2>
      <Table
        head={['Check, after every run', 'Result']}
        rows={[
          ['Stop mid-run left the code as it was', '14 of 14'],
          ['Undo of a message and its code left the tree clean', '14 of 14'],
          ['A broken model key handed over to the next model, no click needed', '10 of 10 hosted runs'],
        ]}
      />
      <P>The two small local models could not produce the inline edit at all, on either build, so they are left out of the failover count.</P>
      <H2>Per model, multi-file task</H2>
      <Table
        head={['Model', 'Failed test runs', 'Proved it works', 'Tokens', 'Seconds']}
        rows={[
          ['Claude Haiku 5.5', '4.5 → 0.5', '0 → 2 of 2', '268k → 313k', '52 → 49'],
          ['Claude Sonnet 5.5', '3.5 → 0', '0 → 2 of 2', '131k → 95k', '37 → 27'],
          ['Claude Opus 5.5', '3.0 → 0', '0 → 2 of 2', '131k → 102k', '44 → 29'],
          ['GPT-5.4 mini', '6.0 → 1.5', '0 → 2 of 2', '610k → 362k', '117 → 69'],
          ['GPT-6.1-sol', '5.0 → 0', '0 → 2 of 2', '157k → 105k', '62 → 41'],
          ['Qwen 3 8B (local)', '0 → 0', '0 → 0', '51k → 7k', '271 → 86'],
          ['Qwen 2.5 Coder 7B (local)', '0 → 0', '0 → 0', '7k → 7k', '41 → 43'],
        ]}
      />
      <P>Before → after, averaged over two runs each. Local models fail the task on both builds, so their numbers say nothing about Anvil.</P>
      <H2>Models we could not measure</H2>
      <Table
        head={['Model', 'Why']}
        rows={[
          ['Groq gpt-oss-120b', 'Groq rejects the reasoning text TrueForge sends back. A TrueForge bug we found.'],
          ['Groq Qwen 3', 'The model called a tool that does not exist; Groq blocks it server-side.'],
          ['OpenRouter free models (3)', 'The free daily quota ran out.'],
          ['OpenRouter Jev Router', 'Not enough account credit for the reply length.'],
        ]}
      />
      <H2>Safety checks, forced to fire</H2>
      <P>
        Real models never triggered the scope, grounding or loop checks on the fixed tasks. A scripted model that misbehaves on purpose drives the real extension and
        TrueForge through 10 scenarios; all 10 pass. Run them with <Code>node scripts/e2e-guards.mjs</Code>.
      </P>
      <Table
        head={['Scenario', 'What the test model does', 'Passes when']}
        rows={[
          ['Grounding and unread lines', <>Edits lines it never read and calls <Code>get_secret_keys()</Code>, defined nowhere</>, 'Both warnings reach the model in its tool result'],
          ['Outside the selection', <>Asked about <Code>get_debug_flag</Code>, edits <Code>get_load_dotenv</Code></>, '“Outside selection” reaches the model'],
          ['Loop guard', <>Repeats the same <Code>read_file</Code></>, 'Nudged at 3, stopped at 5, code untouched'],
          ['Stopping too early', 'Edits, then says “Done, it should work.”', 'Exactly one follow-up, a test run, then a verified finish'],
          ['Partial rejection', 'One edit with two hunks; the first is rejected', 'The model receives “new baseline” and the current text'],
          ['A note mid-run', 'Works slowly while a note is sent', 'The note arrives inside the next tool result, not as a new turn'],
          ['Step limit', 'Keeps searching past a limit of 5 steps', 'No model switch, a notice, one wrap-up turn'],
          ['Selection as context', 'Nothing; a selection is attached', 'The selection is in the request and on the context card'],
          ['Selection toolbar', 'Nothing; code is selected, then deselected', 'Edit, Ask and Add to chat appear only on a selection'],
          ['Read-only helpers', <>A subagent edits, runs pytest, runs <Code>git log</Code></>, 'Edit and pytest refused; git log allowed'],
        ]}
      />
      <H2>Anvil and TrueForge, side by side</H2>
      <Table
        head={['Area', 'TrueForge alone', 'With Anvil']}
        rows={[
          ['Finding code', 'No indexing or retrieval.', 'Ranks every file under a token budget and shows the reason for each pick.'],
          ['Model failure', 'Two retries with backoff, on the one model you configured.', 'Names the cause and hands the same request to the next model. A failing model rests for 60 seconds.'],
          ['Stopping a run', 'Stops the model call, but waits for running tools to finish.', 'Also denies pending approvals, drops open reviews and kills the running command with its child processes.'],
          ['Editor tools', 'An MCP client over HTTP; local addresses blocked by default.', 'Serves search, read, edit and run from a local MCP server with a key that changes on every start.'],
          ['Reviewing edits', 'Allow or deny each tool call.', 'One approval becomes a hunk-by-hunk review. Rejected parts go back with the file as it is now.'],
          ['Saying “done”', 'A turn ends as soon as the model replies without a tool call.', 'Success can only be claimed after a check passes. A turn that ends with untested edits gets one follow-up.'],
          ['Stuck agents', 'No loop detection.', 'A repeated call or a short cycle gets a nudge at 3 and a stop at 5.'],
          ['Typing while it works', 'A new message cancels the running turn.', 'The note joins the running turn at its next step, or “Stop and send” on request.'],
          ['Step limit', 'Ends with “You have reached iteration limit”.', 'A turn-budget hint from half way, then one wrap-up turn.'],
          ['Subagents', 'On by default, sharing all the parent’s tools, writes included.', 'Kept, but write tools and nested subagents are refused.'],
          ['Compaction', 'At 80% of the context window.', 'At 60k input tokens (12k for local models), marked on the context gauge.'],
          ['Tool loading', 'MCP tools are looked up on demand.', 'Anvil’s own editor tools are preloaded.'],
          ['Prompt cache', 'Anthropic caching on by default; usage in events.', 'Tokens and cache hits shown live on the context gauge.'],
        ]}
      />
      <H2>Limits</H2>
      <List
        items={[
          'Safety checks are proven with a scripted model. Real models never triggered them on the fixed tasks, so this shows the checks work, not how often they are needed.',
          'Pass rates barely moved: inline edit and failover 10 of 14 on both builds, stopping clean 14 of 14 on both, the multi-file task 9 to 10 of 14.',
          'The 7 to 8B local models fail the fixed tasks on both builds; they do not produce a usable edit.',
          'The fixed multi-file task is easy for file finding: both builds found every file. File finding is measured on 103 real commits instead.',
          'Two runs per model per build, on one codebase. Haiku used more tokens after the change (313k against 268k).',
        ]}
      />
      <H2>Bugs the benchmarks caught</H2>
      <Table
        head={['Bug', 'What happened']}
        rows={[
          ['Step count 15 times too high', 'Each streamed piece of a reply was counted as a step, so Haiku quit at “116 of 60”.'],
          ['Local models lost most of the prompt', 'Ollama’s default 4k window silently cut it. Local models now run with a 16k window.'],
          ['A lowercase drive letter broke 7 tests', 'c:\\ instead of C:\\ in the command folder made unrelated Flask tests fail.'],
          ['A just-outside edit slipped past the scope check', 'A one-line change right after the selection was treated as an insertion and not flagged.'],
          ['The loop guard missed a pattern', 'A failing test re-run alternating with a rejected finish was not caught.'],
          ['Settings did not reach TrueForge', 'Changing the step limit or reasoning effort mid-session had no effect.'],
          ['The wrap-up summarised the wrong turn', 'It continued from the turn before the one that hit the limit.'],
        ]}
      />
      <P>All seven are fixed.</P>
    </>,
  ),
  doc(
    'troubleshooting',
    'Reference',
    'Troubleshooting',
    'Fixes for the problems people hit most.',
    <Table
      head={['You see', 'Do this']}
      rows={[
        ['The panel says TrueForge is offline', <>Run <Code>npm run harness</Code>, then <b>Settings → General → Reconnect</b>.</>],
        ['No models in the picker', <>Add a provider in <b>Settings → Models</b>, then add models to the chain.</>],
        ['Changes missing after a reload', <>Run <Code>npm run build</Code> first; <Kbd>Ctrl+R</Kbd> reloads the built files.</>],
        ['Another extension fails to activate', 'That extension’s own install is broken. Reinstall or disable it; the F5 window runs only Anvil.'],
        ['An MCP server shows an error', 'Check the URL and auth header, then press Test.'],
      ]}
    />,
  ),
]
