INVENTORY MANAGEMENT SYSTEM: NODE.JS + MYSQL

REQUIREMENTS
- Node.js (already installed by you)
- MySQL Server running locally
- Visual Studio Code
- A browser

STEP 1 - EXTRACT AND OPEN
1. Extract the ZIP.
2. In VS Code choose File > Open Folder.
3. Select the Inventory_Management_System_Node_MySQL folder.

STEP 2 - CREATE THE DATABASE
1. Open MySQL Workbench, phpMyAdmin, or the MySQL command-line client.
2. Run the complete contents of database.sql.
   This creates the inventory_management database and products table.

STEP 3 - CONFIGURE DATABASE LOGIN
1. Copy .env.example and rename the copy to .env (the filename must be exactly .env).
2. Edit .env with your MySQL host, port, username, password, and database name.
3. If your MySQL root account has a password, put it after DB_PASSWORD=.
4. Do not share or upload your .env file.

STEP 4 - INSTALL NODE DEPENDENCIES
In VS Code choose Terminal > New Terminal. Ensure the terminal is in this project folder, then run:
  npm install

STEP 5 - START THE APPLICATION
Run:
  npm start

If successful, the terminal should say the server is running at:
  http://localhost:3000

Open that address in your browser. Do NOT use Live Server for this backend version.
The app must be opened through http://localhost:3000.

STEP 6 - TEST
- The form is prefilled with PRD001, Exercise Books, cost 1500, selling price 2000,
  opening quantity 100, reorder level 20.
- Click Register product.
- The product should appear in the table and remain after browser refresh.
- Try registering PRD001 again: the server/database should reject the duplicate code.
- Try a negative cost or quantity: validation should reject it.
- Visit http://localhost:3000/api/health to check database connection.

TROUBLESHOOTING
- "Cannot connect to MySQL": make sure MySQL Server is installed/running and .env credentials are correct.
- "Access denied": check DB_USER and DB_PASSWORD.
- "Unknown database": run database.sql first and check DB_NAME.
- "Port 3000 already in use": change PORT in .env to 3001, restart, then visit http://localhost:3001.
- "npm is not recognized": Node.js may not be on PATH; close and reopen VS Code, then check `node -v` and `npm -v`.

IMPORTANT
This is a learning project, not a production-ready commercial system. It currently supports product
registration, listing, validation, low-stock status, and deletion. Authentication, roles, suppliers,
purchases, sales transactions, backups, and audit logs would be later enhancements.
