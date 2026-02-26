-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "conditionType" TEXT NOT NULL,
    "thresholdValue" REAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlertRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PortfolioPosition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "assetType" TEXT NOT NULL DEFAULT 'STOCK',
    "quantity" REAL NOT NULL,
    "averageCost" REAL NOT NULL,
    "fees" REAL DEFAULT 0,
    "acquiredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PortfolioPosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetFundamental" (
    "symbol" TEXT NOT NULL PRIMARY KEY,
    "peRatio" REAL,
    "eps" REAL,
    "marketCap" REAL,
    "fiftyTwoWeekHigh" REAL,
    "fiftyTwoWeekLow" REAL,
    "targetPrice" REAL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EarningsEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "epsEstimate" REAL,
    "epsActual" REAL,
    "revenueEstimate" REAL,
    "revenueActual" REAL
);

-- CreateTable
CREATE TABLE "AssetNews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sentimentScore" REAL,
    "publishedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "InviteCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" DATETIME,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "InviteCodeUse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inviteCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "usedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InviteCodeUse_inviteCodeId_fkey" FOREIGN KEY ("inviteCodeId") REFERENCES "InviteCode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InviteCodeUse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Asset" (
    "symbol" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL DEFAULT 'STOCK',
    "market" TEXT NOT NULL DEFAULT 'US',
    "displayName" TEXT NOT NULL,
    "exchange" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isActive" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_Asset" ("currency", "displayName", "exchange", "isActive", "symbol", "type") SELECT "currency", "displayName", "exchange", "isActive", "symbol", "type" FROM "Asset";
DROP TABLE "Asset";
ALTER TABLE "new_Asset" RENAME TO "Asset";
CREATE TABLE "new_UserPreferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'BASIC',
    "timezone" TEXT NOT NULL DEFAULT 'America/Toronto',
    "hideEmptyMarketOverview" BOOLEAN NOT NULL DEFAULT false,
    "hideEmptyCustomUniverses" BOOLEAN NOT NULL DEFAULT false,
    "hideEmptyPortfolio" BOOLEAN NOT NULL DEFAULT false,
    "screenerUniverses" TEXT NOT NULL DEFAULT '["SP500","NASDAQ100","CRYPTO"]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserPreferences" ("createdAt", "id", "mode", "timezone", "updatedAt", "userId") SELECT "createdAt", "id", "mode", "timezone", "updatedAt", "userId" FROM "UserPreferences";
DROP TABLE "UserPreferences";
ALTER TABLE "new_UserPreferences" RENAME TO "UserPreferences";
CREATE UNIQUE INDEX "UserPreferences_userId_key" ON "UserPreferences"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "EarningsEvent_symbol_date_key" ON "EarningsEvent"("symbol", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AssetNews_url_key" ON "AssetNews"("url");

-- CreateIndex
CREATE UNIQUE INDEX "InviteCode_code_key" ON "InviteCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "InviteCodeUse_inviteCodeId_userId_key" ON "InviteCodeUse"("inviteCodeId", "userId");

-- CreateIndex
CREATE INDEX "SymbolCacheState_status_idx" ON "SymbolCacheState"("status");
