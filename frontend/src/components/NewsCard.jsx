import { useEffect, useState } from 'react'
import { Newspaper, ExternalLink, Search, AlertCircle } from 'lucide-react'

export default function NewsCard({ plz, damageDate }) {
  const [news, setNews] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [screenshot, setScreenshot] = useState(null)

  useEffect(() => {
    if (!plz || !damageDate) return
    setLoading(true)
    setNews(null)
    setError(null)
    setScreenshot(null)

    fetch(`/api/news/${plz}?damage_date=${damageDate}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(data => {
        setNews(data)
        if (data.has_screenshot) {
          setScreenshot(`/api/news/${plz}/screenshot?damage_date=${damageDate}`)
        }
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [plz, damageDate])

  if (!plz || !damageDate) return null

  return (
    <div className="glass-card" style={{ padding: 0 }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 30, height: 30,
          background: 'rgba(59,130,246,0.18)',
          border: '1px solid rgba(59,130,246,0.3)',
          borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Newspaper size={15} color="#93c5fd" />
        </div>
        <div>
          <h3 style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>Lokale Pressemeldungen — BBV-Net</h3>
          <p style={{ color: '#64748b', fontSize: 10, marginTop: 1 }}>
            Automatische Recherche bei Bocholter-Borkener Volksblatt zum Schadensdatum
          </p>
        </div>
      </div>

      <div style={{ padding: '16px 20px' }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 12 }}>
            <div style={{
              width: 14, height: 14,
              border: '2px solid rgba(255,255,255,0.08)',
              borderTop: '2px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              flexShrink: 0,
            }} />
            BBV-Net wird durchsucht…
          </div>
        )}

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f87171', fontSize: 12 }}>
            <AlertCircle size={15} />
            Recherche nicht verfügbar: {error}
          </div>
        )}

        {news && !loading && (
          <>
            {news.found ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#4ade80', fontSize: 12, fontWeight: 600 }}>
                  <span style={{ width: 7, height: 7, background: '#22c55e', borderRadius: '50%', display: 'inline-block' }} />
                  {news.articles.length} sturmrelevante Meldung(en) gefunden
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {news.articles.map((art, i) => (
                    <div key={i} style={{
                      padding: '10px 0',
                      borderBottom: i < news.articles.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <p style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600, lineHeight: 1.4 }}>{art.title}</p>
                        {art.url && (
                          <a href={art.url} target="_blank" rel="noopener noreferrer"
                            style={{ color: '#3b82f6', flexShrink: 0, transition: 'color 0.15s' }}>
                            <ExternalLink size={13} />
                          </a>
                        )}
                      </div>
                      {art.date && <p style={{ color: '#475569', fontSize: 10, marginTop: 2 }}>{art.date}</p>}
                      {art.excerpt && <p style={{ color: '#64748b', fontSize: 11, marginTop: 4, lineHeight: 1.5,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {art.excerpt}
                      </p>}
                    </div>
                  ))}
                </div>

                {screenshot && (
                  <div style={{ marginTop: 6 }}>
                    <p style={{ color: '#64748b', fontSize: 10, fontWeight: 600, marginBottom: 8 }}>
                      Screenshot Suchergebnisse:
                    </p>
                    <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden' }}>
                      <img src={screenshot} alt="BBV-Net Suchergebnisse" style={{ width: '100%', display: 'block' }}
                        onError={() => setScreenshot(null)} />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 12 }}>
                <Search size={15} />
                <span>
                  Keine sturmrelevanten Meldungen bei BBV-Net gefunden.{' '}
                  {news.search_url && (
                    <a href={news.search_url} target="_blank" rel="noopener noreferrer"
                      style={{ color: '#3b82f6', textDecoration: 'underline' }}>
                      Selbst suchen →
                    </a>
                  )}
                </span>
              </div>
            )}

            {news.search_url && (
              <a href={news.search_url} target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  marginTop: 12, color: '#3b82f6', fontSize: 11, textDecoration: 'none',
                  transition: 'color 0.15s',
                }}>
                <ExternalLink size={11} />
                Suche auf BBV-Net öffnen: „{news.query}"
              </a>
            )}
          </>
        )}
      </div>
    </div>
  )
}
