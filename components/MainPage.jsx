import { useState } from "react";

const productsData = [
  { id: 1, title: "Samsung A03s", category: "Telefon", price: 250 },
  { id: 2, title: "HP Laptop", category: "Komputer", price: 700 },
  { id: 3, title: "Iphone 12", category: "Telefon", price: 1200 },
  { id: 4, title: "Masaüstü Stol", category: "Ev", price: 80 },
  { id: 5, title: "Televizor LG", category: "Ev", price: 450 },
];

const categories = ["All", "Telefon", "Komputer", "Ev"];

export default function Home() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const filteredProducts = productsData.filter((product) => {
    const matchCategory = selectedCategory === "All" || product.category === selectedCategory;
    const matchSearch = product.title.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <div className="p-5 font-sans">
      <header className="mb-5 flex justify-between items-center">
        <h1 className="text-3xl font-bold">Tap.az Clone</h1>
        <input
          type="text"
          placeholder="Axtar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border p-2 rounded w-1/3"
        />
      </header>

      <div className="mb-5 flex gap-3">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded ${
              selectedCategory === cat ? "bg-blue-500 text-white" : "bg-gray-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {filteredProducts.map((product) => (
          <div key={product.id} className="border p-3 rounded shadow hover:shadow-lg transition">
            <div className="h-40 bg-gray-100 flex items-center justify-center mb-3">
              <span className="text-gray-400">Şəkil</span>
            </div>
            <h2 className="font-bold text-lg mb-2">{product.title}</h2>
            <p className="text-gray-600 mb-2">{product.category}</p>
            <p className="font-semibold">{product.price} AZN</p>
            <button className="mt-2 w-full bg-green-500 text-white py-1 rounded hover:bg-green-600">
              Al
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
