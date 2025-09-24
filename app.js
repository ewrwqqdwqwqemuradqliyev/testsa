document.addEventListener("DOMContentLoaded", () => {
  const categorySelect = document.getElementById("category");

  const carFields = document.getElementById("carFields");
  const phoneFields = document.getElementById("phoneFields");
  const houseFields = document.getElementById("houseFields");

  categorySelect.addEventListener("change", () => {
    // hamısını gizlə
    carFields.style.display = "none";
    phoneFields.style.display = "none";
    houseFields.style.display = "none";

    // seçilən kateqoriyanı göstər
    if (categorySelect.value === "car") {
      carFields.style.display = "block";
    } else if (categorySelect.value === "phone") {
      phoneFields.style.display = "block";
    } else if (categorySelect.value === "house") {
      houseFields.style.display = "block";
    }
  });

  // form submit
  const form = document.getElementById("addAdForm");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    alert("Elan uğurla əlavə olundu!");
    form.reset();
    carFields.style.display = "none";
    phoneFields.style.display = "none";
    houseFields.style.display = "none";
  });
});
