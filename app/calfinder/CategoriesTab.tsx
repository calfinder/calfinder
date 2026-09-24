import { INTEREST_CATEGORIES } from "../../lib/categories";

export function CategoriesTab() {
  return (
    <>
      <h1 className="hero-title">What are you curious about?</h1>
      <p className="subheadline">Eight buckets. Thousands of classes.</p>
      <p className="description">
        Each interest tag maps to a cluster of related departments and topics at Berkeley.
        Use them on the discover page to narrow your search, or leave them blank to see everything happening right now.
      </p>
      <div className="category-table-wrap">
        <table className="category-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Covers</th>
            </tr>
          </thead>
          <tbody>
            {INTEREST_CATEGORIES.map((cat) => (
              <tr key={cat.name}>
                <td className="category-name">{cat.name}</td>
                <td>
                  <p className="category-covers">{cat.covers}</p>
                  <div className="category-examples">
                    {cat.examples.map((ex) => (
                      <span key={ex} className="category-example-pill">{ex}</span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
