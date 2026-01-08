'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Phone, User, MessageCircle, Edit2, Ban, RotateCcw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useLookups } from '@/features/lookups/useLookups';
import { contactsApi } from '@/lib/apiClient';
import { LoadingState } from '@/components/common/LoadingState';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

// 电话号码验证：支持手机号(11位数字)或座机号(区号-号码)
function validatePhone(phone: string): boolean {
  if (!phone || phone.trim() === '') return true; // 空值允许（非必填）
  const mobileRegex = /^1[3-9]\d{9}$/; // 手机号：1开头，第二位3-9，后面9位数字
  const landlineRegex = /^(?:0\d{3}-)?\d{7}$/; // 座机号：区号4位（如0100-），号码7位
  return mobileRegex.test(phone) || landlineRegex.test(phone);
}

export default function ContactsPage() {
  const { contacts, isLoading } = useLookups();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [editingContact, setEditingContact] = useState<{ id: number; name: string; contact_person: string; phone: string; wechat: string; qq: string } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    wechat: '',
    qq: ''
  });

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: contactsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lookups', 'contacts'] });
      setDialogOpen(false);
      setFormData({ name: '', contact_person: '', phone: '', wechat: '', qq: '' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name: string; contact_person?: string; phone?: string; wechat?: string; qq?: string } }) =>
      contactsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lookups', 'contacts'] });
      setEditDialogOpen(false);
      setEditingContact(null);
    },
  });

  const disableMutation = useMutation({
    mutationFn: contactsApi.disable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lookups', 'contacts'] });
    },
    onError: (error: Error) => {
      alert(error.message);
    }
  });

  const enableMutation = useMutation({
    mutationFn: contactsApi.enable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lookups', 'contacts'] });
    },
    onError: (error: Error) => {
      alert(error.message);
    }
  });

  const filteredContacts = contacts.filter((contact) =>
    contact.display.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = () => {
    if (!formData.name) return;
    // 电话验证
    if (!validatePhone(formData.phone)) {
      setPhoneError('请输入正确的手机号(11位)或座机号(区号-号码)');
      return;
    }
    setPhoneError('');
    createMutation.mutate({
      name: formData.name,
      contact_person: formData.contact_person || undefined,
      phone: formData.phone || undefined,
      wechat: formData.wechat || undefined,
      qq: formData.qq || undefined,
    });
  };

  const handleUpdate = () => {
    if (!editingContact || !editingContact.name) return;
    // 电话验证
    if (!validatePhone(editingContact.phone)) {
      setPhoneError('请输入正确的手机号(11位)或座机号(区号-号码)');
      return;
    }
    setPhoneError('');
    updateMutation.mutate({
      id: editingContact.id,
      data: {
        name: editingContact.name,
        contact_person: editingContact.contact_person || undefined,
        phone: editingContact.phone || undefined,
        wechat: editingContact.wechat || undefined,
        qq: editingContact.qq || undefined
      }
    });
  };

  const handleEdit = (contact: typeof contacts[0]) => {
    setPhoneError('');
    setEditingContact({
      id: contact.key.contact_id!,
      name: contact.display.name,
      contact_person: contact.display.contact_person || '',
      phone: contact.display.phone || '',
      wechat: contact.display.wechat || '',
      qq: contact.display.qq || ''
    });
    setEditDialogOpen(true);
  };

  const handleDisable = (contact: typeof contacts[0]) => {
    if (confirm(`确定要废除客户 "${contact.display.name}" 吗？废除后将无法在新订单中使用。`)) {
      disableMutation.mutate(contact.key.contact_id!);
    }
  };

  const handleEnable = (contact: typeof contacts[0]) => {
    if (confirm(`确定要恢复客户 "${contact.display.name}" 吗？`)) {
      enableMutation.mutate(contact.key.contact_id!);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-4">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索客户..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <Button onClick={() => setDialogOpen(true)} className="h-10">
          <Plus className="h-4 w-4 mr-2" />
          添加客户
        </Button>
      </div>

      <Card>
        <CardHeader className="px-3 sm:px-6">
          <CardTitle className="text-base sm:text-lg">客户列表</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingState message="加载中..." />
          ) : filteredContacts.length === 0 ? (
            <div className="p-6 sm:p-8 text-center text-muted-foreground">
              {search ? '未找到匹配的客户' : '暂无客户数据'}
            </div>
          ) : (
            <>
              {/* Mobile: Card layout */}
              <div className="sm:hidden divide-y">
                {filteredContacts.map((contact) => (
                  <div key={contact.key.contact_id} className={`p-3 ${contact.display.is_disabled ? 'opacity-60 bg-muted/30' : ''}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm truncate">{contact.display.name}</span>
                          {contact.display.is_disabled ? (
                            <Badge variant="destructive" className="text-xs flex-shrink-0">已废除</Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-600 border-green-300 text-xs flex-shrink-0">正常</Badge>
                          )}
                        </div>
                        {contact.display.contact_person && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                            <User className="h-3 w-3" />
                            {contact.display.contact_person}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {contact.display.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {contact.display.phone}
                            </div>
                          )}
                          {contact.display.wechat && (
                            <div className="flex items-center gap-1">
                              <MessageCircle className="h-3 w-3" />
                              {contact.display.wechat}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0 ml-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(contact)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        {contact.display.is_disabled ? (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => handleEnable(contact)}>
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDisable(contact)}>
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop: Table layout */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>客户名称</TableHead>
                      <TableHead>联系人</TableHead>
                      <TableHead>联系方式</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="w-[120px]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContacts.map((contact) => (
                      <TableRow key={contact.key.contact_id} className={contact.display.is_disabled ? 'opacity-60' : ''}>
                        <TableCell className="font-medium">{contact.display.name}</TableCell>
                        <TableCell>
                          {contact.display.contact_person ? (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3 text-muted-foreground" />
                              {contact.display.contact_person}
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {contact.display.phone && (
                              <div className="flex items-center gap-1 text-xs">
                                <Phone className="h-3 w-3" />
                                {contact.display.phone}
                              </div>
                            )}
                            {contact.display.wechat && (
                              <div className="flex items-center gap-1 text-xs">
                                <MessageCircle className="h-3 w-3" />
                                {contact.display.wechat}
                              </div>
                            )}
                            {contact.display.qq && (
                              <div className="flex items-center gap-1 text-xs">
                                <span>QQ</span>
                                {contact.display.qq}
                              </div>
                            )}
                            {!contact.display.phone && !contact.display.wechat && !contact.display.qq && '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {contact.display.is_disabled ? (
                            <Badge variant="destructive">已废除</Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-600 border-green-300">正常</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <div className="flex gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEdit(contact)}
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>编辑</p>
                                </TooltipContent>
                              </Tooltip>
                              {contact.display.is_disabled ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleEnable(contact)}
                                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                    >
                                      <RotateCcw className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>恢复</p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDisable(contact)}
                                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    >
                                      <Ban className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>废除</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TooltipProvider>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 添加客户对话框 */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setFormData({ name: '', contact_person: '', phone: '', wechat: '', qq: '' });
          setPhoneError('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加客户</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>客户名称 *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="输入客户名称"
                className="h-10"
              />
            </div>
            <div>
              <Label>联系人</Label>
              <Input
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                placeholder="输入联系人姓名"
                className="h-10"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>电话</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => {
                    setFormData({ ...formData, phone: e.target.value });
                    setPhoneError('');
                  }}
                  placeholder="13800138000"
                  className="h-10"
                />
                {phoneError && <p className="text-xs text-destructive mt-1">{phoneError}</p>}
              </div>
              <div>
                <Label>微信</Label>
                <Input
                  value={formData.wechat}
                  onChange={(e) => setFormData({ ...formData, wechat: e.target.value })}
                  placeholder="输入微信号"
                  className="h-10"
                />
              </div>
            </div>
            <div>
              <Label>QQ</Label>
              <Input
                value={formData.qq}
                onChange={(e) => setFormData({ ...formData, qq: e.target.value })}
                placeholder="输入QQ号"
                className="h-10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={!formData.name || createMutation.isPending}>
              {createMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑客户对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open);
        if (!open) {
          setEditingContact(null);
          setPhoneError('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑客户</DialogTitle>
          </DialogHeader>
          {editingContact && (
            <div className="space-y-4">
              <div>
                <Label>客户名称 *</Label>
                <Input
                  value={editingContact.name}
                  onChange={(e) => setEditingContact({ ...editingContact, name: e.target.value })}
                  placeholder="输入客户名称"
                  className="h-10"
                />
              </div>
              <div>
                <Label>联系人</Label>
                <Input
                  value={editingContact.contact_person}
                  onChange={(e) => setEditingContact({ ...editingContact, contact_person: e.target.value })}
                  placeholder="输入联系人姓名"
                  className="h-10"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>电话</Label>
                  <Input
                    value={editingContact.phone}
                    onChange={(e) => {
                      setEditingContact({ ...editingContact, phone: e.target.value });
                      setPhoneError('');
                    }}
                    placeholder="13800138000"
                    className="h-10"
                  />
                  {phoneError && <p className="text-xs text-destructive mt-1">{phoneError}</p>}
                </div>
                <div>
                  <Label>微信</Label>
                  <Input
                    value={editingContact.wechat}
                    onChange={(e) => setEditingContact({ ...editingContact, wechat: e.target.value })}
                    placeholder="输入微信号"
                    className="h-10"
                  />
                </div>
              </div>
              <div>
                <Label>QQ</Label>
                <Input
                  value={editingContact.qq}
                  onChange={(e) => setEditingContact({ ...editingContact, qq: e.target.value })}
                  placeholder="输入QQ号"
                  className="h-10"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>取消</Button>
            <Button onClick={handleUpdate} disabled={!editingContact?.name || updateMutation.isPending}>
              {updateMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
