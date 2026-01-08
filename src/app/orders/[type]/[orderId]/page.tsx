import { notFound } from 'next/navigation';
import { OrderEditor } from '@/features/orders/components/OrderEditor';

interface OrderPageProps {
  params: {
    type: string;
    orderId: string;
  };
}

export default function OrderPage({ params }: OrderPageProps) {
  const { type, orderId } = params;

  // Validate type parameter
  if (type !== 'sales' && type !== 'purchase') {
    notFound();
  }

  const orderIdNum = parseInt(orderId, 10);
  if (isNaN(orderIdNum)) {
    notFound();
  }

  return <OrderEditor type={type} orderId={orderIdNum} />;
}
