import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { EmptyState } from "../components/EmptyState";
import { getSocialContentById } from "../lib/api";
import { sanitizeRichTextHtml } from "../lib/richText";
import type { SocialContent } from "../types";

const platformName: Record<SocialContent["platform"], string> = {
  instagram: "Instagram", youtube: "YouTube", tiktok: "TikTok",
};

export default function ArticleDetail() {
  const { articleId = "" } = useParams();
  const [article, setArticle] = useState<SocialContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void getSocialContentById(articleId).then((item) => {
      if (active) setArticle(item);
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Impossibile caricare l'articolo.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [articleId]);

  const heroImage = article?.thumbnail_url || article?.image_url;
  const articleText = article?.article_body?.trim() || article?.description?.trim() || "";
  return (
    <PageShell>
      <main className="editorial-article">
        <div className="editorial-article__top">
          <Link to="/#home-featured" className="editorial-article__back">← Torna ai contenuti in evidenza</Link>
          {article && <span className="editorial-article__platform">{platformName[article.platform]} · Community</span>}
        </div>
        {loading ? <p className="admin-message">Caricamento articolo…</p> : !article ? (
          <EmptyState title="Articolo non disponibile" text={error || "Questo contenuto non esiste o non è più disponibile."} />
        ) : (
          <article className="editorial-article__content">
            <div className="editorial-article__banner">
              {heroImage ? <img src={heroImage} alt="" /> : <div className="editorial-article__banner-fallback" aria-hidden="true" />}
            </div>
            <header className="editorial-article__header">
              <span className="eyebrow">Street League · In evidenza</span>
              <h1>{article.title}</h1>
              {article.published_at && <time dateTime={article.published_at}>
                {new Date(article.published_at).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
              </time>}
            </header>
            {articleText ? (
              <div className="editorial-article__body"
                dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(articleText) }} />
            ) : (
              <p className="editorial-article__placeholder">Il testo completo dell'articolo sarà disponibile a breve.</p>
            )}
            <div className="editorial-article__footer">
              <div>
                <span className="eyebrow">Contenuto originale</span>
                <p>Scopri il media pubblicato su {platformName[article.platform]}.</p>
              </div>
              <a className="btn btn--primary" href={article.content_url} target="_blank" rel="noopener noreferrer">
                Visualizza su {platformName[article.platform]} ↗
              </a>
            </div>
          </article>
        )}
      </main>
    </PageShell>
  );
}
