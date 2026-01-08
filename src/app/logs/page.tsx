'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, RefreshCw, ChevronLeft, ChevronRight, Eye, Undo2, Redo2 } from 'lucide-react';
import { logsApi, LogEntry } from '@/lib/apiClient';
import { LoadingState } from '@/components/common/LoadingState';
import { formatDate, formatDateTime } from '@/lib/format';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

const MODULE_LABELS: Record<string, string> = {
  contacts: '客户管理',
  products: '产品管理',
  orders: '订单管理',
  cash: '资金流水'
};

const ACTION_LABELS: Record<string, string> = {
  create: '新增',
  update: '修改',
  delete: '删除',
  verify: '审核',
  cancel: '废弃',
  restore: '恢复',
  upload_image: '上传图片',
  delete_image: '删除图片',
  undo: '撤销',
  redo: '重做'
};

// 可以撤销/重做的操作（新增操作不可撤销，必须留痕迹，只能废除或修改）
const UNDOABLE_ACTIONS = ['update', 'delete', 'verify', 'cancel', 'restore', 'upload_image', 'delete_image'];
const UNDOABLE_MODULES = ['contacts', 'products', 'orders', 'cash'];

export default function LogsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState({ module: '', action: '' });
  const [page, setPage] = useState(1);
  const limit = 20;
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['logs', filter, page],
    queryFn: () => logsApi.getList({
      module: filter.module || undefined,
      action: filter.action || undefined,
      page,
      limit
    })
  });

  // Undo mutation
  const undoMutation = useMutation({
    mutationFn: (logId: number) => logsApi.undo(logId),
    onSuccess: (data) => {
      alert(data.message);
      setDetailOpen(false);
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      // 刷新相关数据
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['lookups'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: Error) => {
      alert(`撤销失败: ${error.message}`);
    }
  });

  // Redo mutation
  const redoMutation = useMutation({
    mutationFn: (logId: number) => logsApi.redo(logId),
    onSuccess: (data) => {
      alert(data.message);
      setDetailOpen(false);
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['lookups'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: Error) => {
      alert(`重做失败: ${error.message}`);
    }
  });

  // 检查操作是否可以撤销/重做
  const canUndoRedo = (log: LogEntry) => {
    return log.display.status === 'success' &&
           UNDOABLE_MODULES.includes(log.display.module) &&
           UNDOABLE_ACTIONS.includes(log.display.action);
  };

  const { data: modules } = useQuery({
    queryKey: ['logs', 'modules'],
    queryFn: logsApi.getModules
  });

  const { data: actions } = useQuery({
    queryKey: ['logs', 'actions'],
    queryFn: logsApi.getActions
  });

  const handleViewDetail = (log: LogEntry) => {
    setSelectedLog(log);
    setDetailOpen(true);
  };

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex gap-2 flex-wrap">
          <div className="relative w-[150px]">
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={filter.module}
              onChange={(e) => {
                setFilter({ ...filter, module: e.target.value });
                setPage(1);
              }}
            >
              <option value="">全部模块</option>
              {modules?.map(m => (
                <option key={m.value} value={m.value}>{MODULE_LABELS[m.value] || m.label}</option>
              ))}
            </select>
          </div>
          <div className="relative w-[120px]">
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={filter.action}
              onChange={(e) => {
                setFilter({ ...filter, action: e.target.value });
                setPage(1);
              }}
            >
              <option value="">全部操作</option>
              {actions?.map(a => (
                <option key={a.value} value={a.value}>{ACTION_LABELS[a.value] || a.label}</option>
              ))}
            </select>
          </div>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>操作日志</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingState message="加载中..." />
          ) : data?.items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              暂无日志记录
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">模块</TableHead>
                    <TableHead className="w-[80px]">操作</TableHead>
                    <TableHead>目标</TableHead>
                    <TableHead className="w-[80px]">状态</TableHead>
                    <TableHead className="w-[80px]">撤销</TableHead>
                    <TableHead className="w-[160px]">时间</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.items.map((log) => (
                    <TableRow
                      key={log.key.log_id}
                      className={`cursor-pointer hover:bg-muted/50 ${log.display.is_undone ? 'opacity-60' : ''}`}
                      onClick={() => handleViewDetail(log)}
                    >
                      <TableCell>
                        <Badge variant="outline">
                          {MODULE_LABELS[log.display.module] || log.display.module}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {ACTION_LABELS[log.display.action] || log.display.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{log.display.target_name || '-'}</span>
                          {log.display.target_type && (
                            <span className="text-xs text-muted-foreground">
                              {log.display.target_type} #{log.display.target_id}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={log.display.status === 'success' ? 'default' : 'destructive'}
                        >
                          {log.display.status === 'success' ? '成功' : '失败'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {log.display.is_undone ? (
                          <Badge variant="outline" className="text-orange-600 border-orange-300">
                            <Undo2 className="w-3 h-3 mr-1" />
                            已撤销
                          </Badge>
                        ) : canUndoRedo(log) ? (
                          <span className="text-xs text-muted-foreground">可撤销</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(log.display.created_at)}
                      </TableCell>
                      <TableCell>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <div className="text-sm text-muted-foreground">
                    共 {data?.total} 条记录，第 {page} / {totalPages} 页
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 日志详情弹窗 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>日志详情</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">模块：</span>
                  <span>{MODULE_LABELS[selectedLog.display.module] || selectedLog.display.module}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">操作：</span>
                  <span>{ACTION_LABELS[selectedLog.display.action] || selectedLog.display.action}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">目标类型：</span>
                  <span>{selectedLog.display.target_type || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">目标ID：</span>
                  <span>{selectedLog.display.target_id || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">状态：</span>
                  <Badge variant={selectedLog.display.status === 'success' ? 'default' : 'destructive'}>
                    {selectedLog.display.status === 'success' ? '成功' : '失败'}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">耗时：</span>
                  <span>{selectedLog.display.duration_ms ? `${selectedLog.display.duration_ms}ms` : '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">IP地址：</span>
                  <span>{selectedLog.display.ip_address || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">时间：</span>
                  <span>{formatDateTime(selectedLog.display.created_at)}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">请求路径：</span>
                  <span className="font-mono text-xs">{selectedLog.display.request_method} {selectedLog.display.request_path}</span>
                </div>
                {selectedLog.display.error_message && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">错误信息：</span>
                    <span className="text-destructive">{selectedLog.display.error_message}</span>
                  </div>
                )}
              </div>

              {selectedLog.display.new_data && (
                <div>
                  <div className="text-sm font-medium mb-2">请求数据：</div>
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.display.new_data, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.display.old_data && (
                <div>
                  <div className="text-sm font-medium mb-2">原数据：</div>
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.display.old_data, null, 2)}
                  </pre>
                </div>
              )}

              {/* 撤销/重做按钮 */}
              {canUndoRedo(selectedLog) && (
                <DialogFooter className="border-t pt-4">
                  {selectedLog.display.is_undone ? (
                    // 已撤销状态：只显示重做按钮
                    <Button
                      variant="default"
                      onClick={() => {
                        if (confirm('确定要重做此操作吗？这将重新应用此操作。')) {
                          redoMutation.mutate(selectedLog.key.log_id);
                        }
                      }}
                      disabled={redoMutation.isPending}
                      className="w-full"
                    >
                      <Redo2 className="w-4 h-4 mr-2" />
                      {redoMutation.isPending ? '重做中...' : '重做此操作'}
                    </Button>
                  ) : (
                    // 未撤销状态：只显示撤销按钮
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (confirm('确定要撤销此操作吗？这将回滚数据到操作前的状态。')) {
                          undoMutation.mutate(selectedLog.key.log_id);
                        }
                      }}
                      disabled={undoMutation.isPending}
                      className="w-full"
                    >
                      <Undo2 className="w-4 h-4 mr-2" />
                      {undoMutation.isPending ? '撤销中...' : '撤销此操作'}
                    </Button>
                  )}
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
