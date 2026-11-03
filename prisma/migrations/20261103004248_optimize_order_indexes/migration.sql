-- DropIndex
DROP INDEX "Order_idempotencyKey_idx";

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
