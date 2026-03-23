'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, StickyNote, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import * as api from '@/lib/xmonitor-api';
import type { StrategyNote } from '@/types/xmonitor';

export function StrategyNotes() {
  const [notes, setNotes] = useState<StrategyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<StrategyNote | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const loadNotes = useCallback(async () => {
    try {
      const data = await api.fetchNotes();
      setNotes(data);
    } catch (e) {
      console.error('[Notes] Failed to fetch:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const openAdd = useCallback(() => {
    setEditingNote(null);
    setTitle('');
    setContent('');
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((note: StrategyNote) => {
    setEditingNote(note);
    setTitle(note.title);
    setContent(note.content);
    setDialogOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      if (editingNote) {
        const updated = await api.updateNote(editingNote.id, { title, content });
        setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      } else {
        const created = await api.createNote(title, content);
        setNotes((prev) => [created, ...prev]);
      }
      setDialogOpen(false);
    } catch (e) {
      console.error('[Notes] Failed to save:', e);
    } finally {
      setSaving(false);
    }
  }, [editingNote, title, content]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await api.deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      console.error('[Notes] Failed to delete:', e);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h2 className="text-lg font-semibold">My Strategy Notes</h2>
          <p className="text-xs text-muted-foreground">
            Record and manage your personal trading strategies.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openAdd}>
          <Plus className="h-3.5 w-3.5" />
          Add Note
        </Button>
      </div>

      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-muted-foreground">
          <StickyNote className="mb-3 h-10 w-10 opacity-40" />
          <p className="text-sm font-medium">No notes yet</p>
          <p className="text-xs">Click &quot;Add Note&quot; to create your first strategy note.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {notes.map((note) => (
            <div
              key={note.id}
              className="group flex flex-col rounded-lg border bg-card p-3 transition-colors hover:bg-accent/30"
            >
              {/* Title + actions */}
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-medium leading-snug break-words min-w-0">
                  {note.title}
                </h3>
                <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                    onClick={() => openEdit(note)}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleDelete(note.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Separator */}
              <div className="my-2 border-t border-border/60" />

              {/* Full content */}
              <p className="flex-1 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap break-words">
                {note.content || <span className="italic opacity-50">No content</span>}
              </p>

              {/* Date */}
              <span className="mt-2 block text-[10px] text-muted-foreground/60">
                {new Date(note.updatedAt).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingNote ? 'Edit Note' : 'New Note'}</DialogTitle>
            <DialogDescription>
              {editingNote
                ? 'Update your strategy note.'
                : 'Create a new strategy note with title and content.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. BTC 突破策略"
                className="bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Content</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your strategy details here..."
                className="min-h-[120px] bg-background"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!title.trim() || saving}>
              {saving && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              {editingNote ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
