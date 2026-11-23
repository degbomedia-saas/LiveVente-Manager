'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export const PAGE_SIZE = 20

export function ServerPagination({
  currentPage,
  totalCount,
  pageSize = PAGE_SIZE,
  basePath,
  extraQuery = {},
  lang = 'fr',
}: {
  currentPage: number
  totalCount: number
  pageSize?: number
  basePath: string
  extraQuery?: Record<string, string | undefined>
  lang?: 'fr' | 'en'
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const safePage = Math.min(Math.max(1, currentPage), totalPages)
  const fromItem = totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1
  const toItem = Math.min(totalCount, safePage * pageSize)

  function buildHref(targetPage: number): string {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(extraQuery)) {
      if (v !== undefined && v !== '') {
        params.set(k, v)
      }
    }
    params.set('page', String(targetPage))
    return `${basePath}?${params.toString()}`
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-2xs">
      <p className="text-xs sm:text-sm font-medium text-slate-600">
        {lang === 'fr' ? (
          <>
            Affichage <strong className="text-slate-900">{fromItem}</strong>–
            <strong className="text-slate-900">{toItem}</strong> sur{' '}
            <strong className="text-slate-900">{totalCount}</strong> • Page{' '}
            <strong className="text-slate-900">{safePage}</strong> /{' '}
            <strong className="text-slate-900">{totalPages}</strong> (
            {pageSize}/page)
          </>
        ) : (
          <>
            Showing <strong className="text-slate-900">{fromItem}</strong>–
            <strong className="text-slate-900">{toItem}</strong> of{' '}
            <strong className="text-slate-900">{totalCount}</strong> • Page{' '}
            <strong className="text-slate-900">{safePage}</strong> /{' '}
            <strong className="text-slate-900">{totalPages}</strong> (
            {pageSize}/page)
          </>
        )}
      </p>

      <div className="flex items-center justify-between sm:justify-end gap-2">
        {safePage > 1 ? (
          <Link
            href={buildHref(safePage - 1)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{lang === 'fr' ? 'Précédent' : 'Previous'}</span>
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-50 text-slate-400 border border-slate-200 opacity-60 cursor-not-allowed">
            <ChevronLeft className="w-4 h-4" />
            <span>{lang === 'fr' ? 'Précédent' : 'Previous'}</span>
          </span>
        )}

        <span className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-extrabold tabular-nums">
          {safePage} / {totalPages}
        </span>

        {safePage < totalPages ? (
          <Link
            href={buildHref(safePage + 1)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 transition"
          >
            <span>{lang === 'fr' ? 'Suivant' : 'Next'}</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-50 text-slate-400 border border-slate-200 opacity-60 cursor-not-allowed">
            <span>{lang === 'fr' ? 'Suivant' : 'Next'}</span>
            <ChevronRight className="w-4 h-4" />
          </span>
        )}
      </div>
    </div>
  )
}
