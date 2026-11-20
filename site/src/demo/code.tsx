const KEYWORDS = new Set(['def', 'return', 'import', 'as', 'from', 'and', 'not', 'in', 'or', 'if', 'for', 'None', 'True', 'False'])

const color = {
  keyword: '#c586c0',
  string: '#ce9178',
  fn: '#dcdcaa',
  type: '#4ec9b0',
  decorator: '#dcdcaa',
  number: '#b5cea8',
  text: '#d4d4d4',
  doc: '#6a9955',
}

export const docMask = (lines: string[]) => {
  let open = false
  return lines.map((line) => {
    const quotes = (line.match(/"""/g) ?? []).length
    const inside = open || quotes > 0
    if (quotes % 2 === 1) open = !open
    return inside
  })
}

export function Code({ text, doc = false }: { text: string; doc?: boolean }) {
  if (doc) return <span style={{ color: color.doc }}>{text}</span>
  const parts = text.split(/("[^"]*"|'[^']*'|\b\w+\b|@\w+(?:\.\w+)*)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null
        let c = color.text
        if (/^["']/.test(part)) c = color.string
        else if (part.startsWith('@')) c = color.decorator
        else if (KEYWORDS.has(part)) c = color.keyword
        else if (/^\d+$/.test(part)) c = color.number
        else if (/^[A-Z]\w*$/.test(part) || part === 'bool' || part === 'str') c = color.type
        else if (parts[i + 1]?.startsWith('(')) c = color.fn
        return (
          <span key={i} style={{ color: c }}>
            {part}
          </span>
        )
      })}
    </>
  )
}

export const helpersBefore = [
  'import os',
  'import typing as t',
  '',
  '',
  'def get_debug_flag() -> bool:',
  '    """Get whether debug mode should be enabled for the app,',
  '    indicated by the :envvar:`FLASK_DEBUG` environment variable.',
  '    The default is ``False``.',
  '    """',
  '    val = os.environ.get("FLASK_DEBUG")',
  '    return bool(val and val.lower() not in {"0", "false", "no"})',
  '',
  '',
  'def get_load_dotenv(default: bool = True) -> bool:',
  '    """Get whether the user has disabled loading default dotenv',
  '    files by setting :envvar:`FLASK_SKIP_DOTENV`.',
  '    """',
  '    val = os.environ.get("FLASK_SKIP_DOTENV")',
  '',
  '    if not val:',
  '        return default',
  '',
  '    return val.lower() in ("0", "false", "no")',
  '',
  '',
  'def stream_with_context(generator_or_function):',
  '    """Wrap a generator so the request context stays active."""',
  '    ...',
  '',
  '',
  'def make_response(*args: t.Any) -> Response:',
  '    """Convert the return value of a view into a response."""',
  '    ...',
]

export const helpersHunks = [
  { index: 7, added: '    ``0``, ``false``, ``no``, ``off`` and ``n`` mean ``False``.' },
  { index: 10, added: '    return bool(val and val.lower() not in {"0", "false", "no", "off", "n"})' },
]

export const cliLines = [
  '@click.command("routes", short_help="Show the routes for the app.")',
  '@with_appcontext',
  'def routes_command(sort: str, all_methods: bool) -> None:',
  '    """Show all registered routes with endpoints and methods."""',
  '    rules = list(current_app.url_map.iter_rules())',
  '    ...',
  '',
  '',
]

export const cliAdded = [
  '@click.command("config", short_help="Show the app config.")',
  '@with_appcontext',
  'def config_command() -> None:',
  '    """Print the loaded configuration as JSON, masking secrets."""',
  '    hidden = ("SECRET", "PASSWORD", "TOKEN", "KEY")',
  '    data = {',
  '        key: "***" if any(word in key for word in hidden) else value',
  '        for key, value in current_app.config.items()',
  '    }',
  '    click.echo(json.dumps(data, indent=2, default=str))',
  '',
  '',
]

export const cliAfter = [
  'cli = FlaskGroup(',
  '    name="flask",',
  '    help="A general utility script for Flask applications.",',
  ')',
  'cli.add_command(run_command)',
  'cli.add_command(shell_command)',
  'cli.add_command(routes_command)',
  'cli.add_command(config_command)',
  '',
  '',
  'def main() -> None:',
  '    cli.main()',
  '',
  '',
  'if __name__ == "__main__":',
  '    main()',
]
