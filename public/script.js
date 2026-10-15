const form = document.getElementById("productForm");
const message = document.getElementById("message");
const tbody = document.getElementById("productsTable");
const count = document.getElementById("productCount");
const ids = ["productCode", "productName", "unitCost", "sellingPrice", "openingQuantity", "reorderLevel"];
const field = id => document.getElementById(id);

function showMessage(text, type) {
  message.textContent = text;
  message.className = "message " + type;
  message.hidden = false;
}
function clearMessage() {
  message.hidden = true;
  message.textContent = "";
  message.className = "message";
}
function markInvalid(id, invalid) {
  field(id).classList.toggle("invalid", invalid);
  field(id).setAttribute("aria-invalid", invalid ? "true" : "false");
}
function money(amount) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency", currency: "UGX", maximumFractionDigits: 2
  }).format(amount);
}
function addCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  row.appendChild(cell);
  return cell;
}

async function loadProducts() {
  try {
    const response = await fetch("/api/products");
    const products = await response.json();
    if (!response.ok) throw new Error(products.message || "Unable to load products.");
    count.textContent = products.length;
    tbody.replaceChildren();

    if (products.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 8;
      cell.className = "empty";
      cell.textContent = "No products saved yet. Register a product above.";
      row.appendChild(cell);
      tbody.appendChild(row);
      return;
    }

    products.forEach(product => {
      const row = document.createElement("tr");
      [
        product.productCode, product.productName, money(product.unitCost),
        money(product.sellingPrice), String(product.quantityInStock),
        String(product.reorderLevel)
      ].forEach(value => addCell(row, value));

      const statusCell = document.createElement("td");
      const badge = document.createElement("span");
      const low = product.quantityInStock <= product.reorderLevel;
      badge.className = "status " + (low ? "low" : "good");
      badge.textContent = low ? "LOW STOCK" : "IN STOCK";
      statusCell.appendChild(badge);
      row.appendChild(statusCell);

      const actionCell = document.createElement("td");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "delete";
      button.textContent = "Delete";
      button.addEventListener("click", async () => {
        if (!confirm(`Delete product ${product.productCode}?`)) return;
        try {
          const response = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
          const result = await response.json();
          if (!response.ok) throw new Error(result.message || "Delete failed.");
          showMessage(result.message, "success");
          await loadProducts();
        } catch (error) {
          showMessage(error.message, "error");
        }
      });
      actionCell.appendChild(button);
      row.appendChild(actionCell);
      tbody.appendChild(row);
    });
  } catch (error) {
    count.textContent = "—";
    tbody.replaceChildren();
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 8;
    cell.className = "empty";
    cell.textContent = "Could not load products. Make sure the Node.js server and MySQL are running.";
    row.appendChild(cell);
    tbody.appendChild(row);
    showMessage(error.message, "error");
  }
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  clearMessage();
  ids.forEach(id => markInvalid(id, false));

  const product = {
    productCode: field("productCode").value.trim().toUpperCase(),
    productName: field("productName").value.trim(),
    unitCost: field("unitCost").value === "" ? null : Number(field("unitCost").value),
    sellingPrice: field("sellingPrice").value === "" ? null : Number(field("sellingPrice").value),
    openingQuantity: field("openingQuantity").value === "" ? null : Number(field("openingQuantity").value),
    reorderLevel: field("reorderLevel").value === "" ? null : Number(field("reorderLevel").value)
  };

  const errors = [];
  if (!/^[A-Z0-9-]{3,30}$/.test(product.productCode)) {
    errors.push("Product code must be 3–30 characters using letters, numbers or hyphens.");
    markInvalid("productCode", true);
  }
  if (!product.productName || product.productName.length > 100) {
    errors.push("Enter a product name of 1–100 characters.");
    markInvalid("productName", true);
  }
  for (const id of ["unitCost", "sellingPrice"]) {
    if (product[id] === null || !Number.isFinite(product[id]) || product[id] < 0) {
      errors.push((id === "unitCost" ? "Unit cost" : "Selling price") + " must be zero or greater.");
      markInvalid(id, true);
    }
  }
  for (const id of ["openingQuantity", "reorderLevel"]) {
    if (product[id] === null || !Number.isInteger(product[id]) || product[id] < 0) {
      errors.push((id === "openingQuantity" ? "Opening quantity" : "Reorder level") + " must be a non-negative whole number.");
      markInvalid(id, true);
    }
  }
  if (errors.length) {
    showMessage(errors.join(" "), "error");
    return;
  }

  try {
    const response = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Product could not be saved.");
    form.reset();
    ids.forEach(id => markInvalid(id, false));
    showMessage(result.message, "success");
    await loadProducts();
  } catch (error) {
    showMessage(error.message + " Ensure the server is running and MySQL is configured.", "error");
  }
});

document.getElementById("clearButton").addEventListener("click", () => {
  form.reset();
  clearMessage();
  ids.forEach(id => markInvalid(id, false));
});
document.getElementById("refreshButton").addEventListener("click", loadProducts);

loadProducts();
