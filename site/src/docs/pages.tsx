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
