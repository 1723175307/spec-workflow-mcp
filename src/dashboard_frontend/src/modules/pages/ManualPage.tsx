import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MarkdownIt from 'markdown-it';
import './ManualPage.css';

// The manual and its screenshots live in public/manual and are served as static files.
const MANUAL_BASE = '/manual/';
const MANUAL_MD = `${MANUAL_BASE}manual.md`;
const MANUAL_PDF = `${MANUAL_BASE}manual.pdf`;

interface TocItem {
  id: string;
  text: string;
}

function createRenderer() {
  // The manual is a static file shipped with the dashboard; html is on so table cells can use <br>.
  const md = new MarkdownIt({ html: true, linkify: true, breaks: false });

  // Screenshots are referenced as "images/xx.png" in the markdown; serve them from /manual/.
  const defaultImage = md.renderer.rules.image!;
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const src = token.attrGet('src') || '';
    if (!/^(https?:)?\//.test(src)) token.attrSet('src', MANUAL_BASE + src);
    token.attrSet('loading', 'lazy');
    return defaultImage(tokens, idx, options, env, self);
  };

  // Open external links in a new tab.
  const defaultLinkOpen =
    md.renderer.rules.link_open || ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    tokens[idx].attrSet('target', '_blank');
    tokens[idx].attrSet('rel', 'noopener noreferrer');
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  // Give every h2 a stable id so the table of contents can scroll to it.
  md.core.ruler.push('manual_heading_ids', (state) => {
    let n = 0;
    for (const token of state.tokens) {
      if (token.type === 'heading_open' && token.tag === 'h2') token.attrSet('id', `manual-sec-${n++}`);
    }
  });

  return md;
}

export function ManualPage() {
  const { t } = useTranslation();
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const md = useMemo(createRenderer, []);

  useEffect(() => {
    let cancelled = false;
    fetch(MANUAL_MD)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.text();
      })
      .then((text) => !cancelled && setSource(text))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const html = useMemo(() => (source ? md.render(source) : ''), [md, source]);

  const toc = useMemo<TocItem[]>(() => {
    if (!source) return [];
    const items: TocItem[] = [];
    md.parse(source, {}).forEach((token, i, all) => {
      if (token.type === 'heading_open' && token.tag === 'h2') {
        items.push({ id: `manual-sec-${items.length}`, text: all[i + 1]?.content ?? '' });
      }
    });
    return items;
  }, [md, source]);

  // Clicking a screenshot opens it full size.
  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG') window.open((target as HTMLImageElement).src, '_blank', 'noopener');
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="grid gap-4">
      <div className="bg-[var(--surface-panel)] border border-[var(--border-default)] rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('manual.title', 'User Manual')}</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{t('manual.subtitle', 'What each dashboard page is for and how to use it')}</p>
        </div>
        <a
          href={MANUAL_PDF}
          download="spec-workflow 看板使用说明与操作手册.pdf"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--interactive-primary)] hover:opacity-90 text-white text-sm font-medium rounded-md transition-opacity self-start sm:self-auto"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {t('manual.downloadPdf', 'Download PDF')}
        </a>
      </div>

      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0 bg-[var(--surface-panel)] border border-[var(--border-default)] rounded-lg p-4 sm:p-8">
          {error && <p className="text-sm text-[var(--text-muted)]">{t('manual.loadError', 'The manual could not be loaded.')}</p>}
          {!error && !source && <p className="text-sm text-[var(--text-muted)]">{t('manual.loading', 'Loading manual...')}</p>}
          {source && (
            <div
              className="manual-content"
              onClick={handleContentClick}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>

        {toc.length > 0 && (
          <nav className="hidden xl:block w-60 flex-shrink-0 sticky top-4 bg-[var(--surface-panel)] border border-[var(--border-default)] rounded-lg p-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">
              {t('manual.contents', 'Contents')}
            </div>
            <ul className="space-y-1">
              {toc.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => scrollTo(item.id)}
                    className="w-full text-left text-sm text-[var(--text-secondary)] hover:text-[var(--interactive-primary)] py-1 px-2 rounded hover:bg-[var(--surface-hover)]"
                  >
                    {item.text}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </div>
  );
}
