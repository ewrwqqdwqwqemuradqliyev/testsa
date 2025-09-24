import React, { useEffect, useState } from "react";
import axios from "axios";

const AdminPanel = () => {
  const [ads, setAds] = useState([]);

  const fetchAds = async () => {
    const res = await axios.get("http://localhost:5000/api/ads");
    setAds(res.data);
  };

  useEffect(() => {
    fetchAds();
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h1>Admin Panel</h1>
      <h2>Bütün elanlar</h2>
      <ul>
        {ads.map((ad, index) => (
          <li key={index} style={{ marginBottom: "20px" }}>
            <h3>{ad.title}</h3>
            <p>{ad.description}</p>
            {ad.image && (
              <img
                src={`http://localhost:5000/uploads/${ad.image}`}
                alt={ad.title}
                style={{ maxWidth: "200px" }}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AdminPanel;
