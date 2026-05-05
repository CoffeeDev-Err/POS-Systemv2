-- MSSQL-compatible schema for pos_system_v2
IF DB_ID('pos_system_v2') IS NULL
BEGIN
  CREATE DATABASE pos_system_v2;
END
GO

USE pos_system_v2;
GO

IF OBJECT_ID('dbo.categories','U') IS NULL
BEGIN
  CREATE TABLE dbo.categories (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at DATETIME2(0) NOT NULL DEFAULT GETDATE()
  );
END
GO

IF OBJECT_ID('dbo.users','U') IS NULL
BEGIN
  CREATE TABLE dbo.users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CONSTRAINT DF_users_role DEFAULT 'cashier'
      CONSTRAINT CK_users_role CHECK (role IN ('superadmin','admin','cashier')),
    active BIT NOT NULL CONSTRAINT DF_users_active DEFAULT 1,
    created_at DATE NOT NULL,
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_users_updated_at DEFAULT GETDATE()
  );
END
GO

IF OBJECT_ID('dbo.products','U') IS NULL
BEGIN
  CREATE TABLE dbo.products (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    category_id INT NOT NULL,
    price DECIMAL(10,2) NOT NULL CONSTRAINT DF_products_price DEFAULT 0,
    cost DECIMAL(10,2) NOT NULL CONSTRAINT DF_products_cost DEFAULT 0,
    unit VARCHAR(30) NOT NULL,
    stock INT NOT NULL CONSTRAINT DF_products_stock DEFAULT 0,
    low_stock_alert INT NOT NULL CONSTRAINT DF_products_low_stock DEFAULT 0,
    active BIT NOT NULL CONSTRAINT DF_products_active DEFAULT 1,
    created_at DATE NOT NULL,
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_products_updated_at DEFAULT GETDATE(),
    CONSTRAINT fk_products_category
      FOREIGN KEY (category_id) REFERENCES dbo.categories(id)
      ON UPDATE CASCADE
      ON DELETE NO ACTION
  );
END
GO

IF OBJECT_ID('dbo.transactions','U') IS NULL
BEGIN
  CREATE TABLE dbo.transactions (
    id VARCHAR(32) NOT NULL PRIMARY KEY,
    [date] DATE NOT NULL,
    [time] TIME NOT NULL,
    cashier_id INT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    cash DECIMAL(10,2) NOT NULL,
    change_amount DECIMAL(10,2) NOT NULL,
    created_at DATETIME2(0) NOT NULL DEFAULT GETDATE(),
    CONSTRAINT fk_transactions_cashier
      FOREIGN KEY (cashier_id) REFERENCES dbo.users(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL
  );
END
GO

IF OBJECT_ID('dbo.transaction_items','U') IS NULL
BEGIN
  CREATE TABLE dbo.transaction_items (
    id INT IDENTITY(1,1) PRIMARY KEY,
    transaction_id VARCHAR(32) NOT NULL,
    product_id INT NULL,
    product_name VARCHAR(150) NOT NULL,
    qty INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    cost DECIMAL(10,2) NOT NULL CONSTRAINT DF_txn_items_cost DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    cost_total DECIMAL(10,2) NOT NULL CONSTRAINT DF_txn_items_cost_total DEFAULT 0,
    created_at DATETIME2(0) NOT NULL DEFAULT GETDATE(),
    CONSTRAINT fk_txn_items_txn
      FOREIGN KEY (transaction_id) REFERENCES dbo.transactions(id)
      ON UPDATE CASCADE
      ON DELETE CASCADE,
    CONSTRAINT fk_txn_items_product
      FOREIGN KEY (product_id) REFERENCES dbo.products(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL
  );
END
GO

IF OBJECT_ID('dbo.stock_movements','U') IS NULL
BEGIN
  CREATE TABLE dbo.stock_movements (
    id INT IDENTITY(1,1) PRIMARY KEY,
    product_id INT NOT NULL,
    [type] VARCHAR(20) NOT NULL
      CONSTRAINT CK_stock_type CHECK ([type] IN ('stock-in','stock-out','sale','adjustment')),
    qty INT NOT NULL,
    note VARCHAR(255) NULL,
    movement_date DATE NOT NULL,
    movement_time TIME NOT NULL,
    created_by INT NULL,
    created_at DATETIME2(0) NOT NULL DEFAULT GETDATE(),
    CONSTRAINT fk_stock_product
      FOREIGN KEY (product_id) REFERENCES dbo.products(id)
      ON UPDATE CASCADE
      ON DELETE NO ACTION,
    CONSTRAINT fk_stock_user
      FOREIGN KEY (created_by) REFERENCES dbo.users(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL
  );
END
GO

IF OBJECT_ID('dbo.audit_logs','U') IS NULL
BEGIN
  CREATE TABLE dbo.audit_logs (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(255) NOT NULL,
    created_at DATETIME2(0) NOT NULL DEFAULT GETDATE(),
    CONSTRAINT fk_audit_user
      FOREIGN KEY (user_id) REFERENCES dbo.users(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL
  );
END
GO

IF OBJECT_ID('dbo.expenses','U') IS NULL
BEGIN
  CREATE TABLE dbo.expenses (
    id INT IDENTITY(1,1) PRIMARY KEY,
    expense_date DATE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    category VARCHAR(80) NOT NULL,
    note VARCHAR(255) NULL,
    created_by INT NULL,
    created_at DATETIME2(0) NOT NULL DEFAULT GETDATE(),
    CONSTRAINT fk_expenses_user
      FOREIGN KEY (created_by) REFERENCES dbo.users(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL
  );
END
GO

IF OBJECT_ID('dbo.store_settings','U') IS NULL
BEGIN
  CREATE TABLE dbo.store_settings (
    id TINYINT NOT NULL PRIMARY KEY,
    store_name VARCHAR(100) NOT NULL,
    address VARCHAR(150) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    receipt_footer VARCHAR(255) NOT NULL,
    updated_at DATETIME2(0) NOT NULL DEFAULT GETDATE()
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_transactions_date' AND object_id = OBJECT_ID('dbo.transactions'))
  CREATE INDEX idx_transactions_date ON dbo.transactions([date]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_expenses_date' AND object_id = OBJECT_ID('dbo.expenses'))
  CREATE INDEX idx_expenses_date ON dbo.expenses(expense_date);
GO

IF OBJECT_ID('dbo.trg_users_updated_at','TR') IS NOT NULL
  DROP TRIGGER dbo.trg_users_updated_at;
GO
CREATE TRIGGER dbo.trg_users_updated_at
ON dbo.users
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE u
    SET updated_at = GETDATE()
  FROM dbo.users u
  INNER JOIN inserted i ON u.id = i.id;
END
GO

IF OBJECT_ID('dbo.trg_products_updated_at','TR') IS NOT NULL
  DROP TRIGGER dbo.trg_products_updated_at;
GO
CREATE TRIGGER dbo.trg_products_updated_at
ON dbo.products
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE p
    SET updated_at = GETDATE()
  FROM dbo.products p
  INNER JOIN inserted i ON p.id = i.id;
END
GO

IF OBJECT_ID('dbo.trg_store_settings_updated_at','TR') IS NOT NULL
  DROP TRIGGER dbo.trg_store_settings_updated_at;
GO
CREATE TRIGGER dbo.trg_store_settings_updated_at
ON dbo.store_settings
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE s
    SET updated_at = GETDATE()
  FROM dbo.store_settings s
  INNER JOIN inserted i ON s.id = i.id;
END
GO
