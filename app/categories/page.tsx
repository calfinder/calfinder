import Link from "next/link";
import styles from "./page.module.css";
import { INTEREST_CATEGORIES } from "../../lib/categories";

export default function CategoriesPage() {
  return (
    <div className={styles.root}>
      <nav className={styles.nav}>
        <Link href="/" className={styles.logo}>
          <div className={styles.logoMark}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <text x="2" y="13" fontFamily="Georgia" fontSize="12" fontWeight="bold" fill="#FDB515">CF</text>
            </svg>
          </div>
          <span className={styles.logoWordmark}>CalFinder</span>
        </Link>
        <Link href="/" className={styles.backLink}>← Back to discover</Link>
      </nav>

      <main className={styles.main}>
        <p className={styles.eyebrow}>Interest categories</p>
        <h1 className={styles.title}>What are you curious about?</h1>
        <p className={styles.subtitle}>Eight buckets. Thousands of classes.</p>
        <p className={styles.desc}>
          Each interest tag maps to a cluster of related departments and topics at Berkeley.
          Use them on the discover page to narrow your search, or leave them blank to see everything happening right now.
        </p>

        <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Category</th>
              <th>Covers</th>
            </tr>
          </thead>
          <tbody>
            {INTEREST_CATEGORIES.map((cat) => (
              <tr key={cat.name}>
                <td>{cat.name}</td>
                <td className={styles.covers}>
                  {cat.covers}
                  <div className={styles.exampleList}>
                    {cat.examples.map((ex) => (
                      <span key={ex} className={styles.examplePill}>{ex}</span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </main>

      <footer className={styles.footer}>
        <span className={styles.footerNote}>CalFinder · UC Berkeley</span>
        <span className={styles.footerNote}>Tags are inferred, some courses may span multiple categories.</span>
      </footer>
    </div>
  );
}
