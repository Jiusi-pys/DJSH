// Zod schemas for order form validation

import { z } from 'zod';

export const orderItemSchema = z.object({
  item_id: z.number(),
  product_id: z.number().nullable(),
  product_name_raw: z.string().nullable(),
  unit: z.string().min(1, '单位不能为空'),
  unit_price: z.number().min(0, '单价不能为负数'),
  quantity: z.number().min(0, '数量不能为负数'),
});

export const orderSchema = z.object({
  contact_id: z.number().nullable().optional(),
  contact_name_raw: z.string().nullable().optional(),
  order_date: z.string().min(1, '请选择日期'),
  remark: z.string().optional(),
  items: z.array(orderItemSchema).min(1, '至少需要添加一个商品'),
});

export type OrderFormValues = z.infer<typeof orderSchema>;
export type OrderItemFormValues = z.infer<typeof orderItemSchema>;
