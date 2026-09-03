import { NextRequest, NextResponse } from 'next/server';
import { fetchSepayTransactions, processSepayTransaction } from '@/lib/sepay';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const transactions = await fetchSepayTransactions(limit);

    let processedCount = 0;
    let duplicateCount = 0;
    let matchedCount = 0;
    let unmatchedCount = 0;
    const errors: string[] = [];

    for (const tx of transactions) {
      try {
        const result = await processSepayTransaction(tx);
        processedCount++;
        if (result.duplicate) {
          duplicateCount++;
        } else if (result.matched) {
          matchedCount++;
        } else if (result.matched === false) {
          unmatchedCount++;
        }
      } catch (err) {
        errors.push(`Giao dịch ${tx.id || tx.referenceCode}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Đã đồng bộ ${transactions.length} giao dịch từ SePay: ${matchedCount} đã gạch nợ, ${unmatchedCount} chưa khớp, ${duplicateCount} đã có sẵn.`,
      stats: {
        totalFetched: transactions.length,
        processedCount,
        matchedCount,
        unmatchedCount,
        duplicateCount,
        errors,
      },
    });
  } catch (error) {
    console.error('Error syncing SePay transactions:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Lỗi khi đồng bộ giao dịch từ SePay API',
      },
      { status: 500 }
    );
  }
}
