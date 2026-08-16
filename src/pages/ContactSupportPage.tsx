import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SupportMessageEditor } from "@/components/support/SupportMessageEditor";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/notify";
import { useAgency } from "@/contexts/AgencyContext";
import { useAppTranslation } from "@/hooks/useAppTranslation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, MessageCircle, CheckCircle, Eye, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { SupportMessageContent } from "@/components/support/SupportMessageContent";
import { INPUT_LIMITS } from "@/constants/inputLimits";

interface MyTicketRow {
  id: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}

interface MyTicketReply {
  id: string;
  author_display?: string | null;
  message: string;
  created_at: string;
  is_from_support: boolean;
}

export default function ContactSupportPage() {
  const { currentAgency } = useAgency();
  const { user: authUser } = useAuth();
  const { t, i18n } = useAppTranslation();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const [myTickets, setMyTickets] = useState<MyTicketRow[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketDetail, setTicketDetail] = useState<MyTicketRow | null>(null);
  const [replies, setReplies] = useState<MyTicketReply[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [messageKey, setMessageKey] = useState(0);
  const [replyKey, setReplyKey] = useState(0);
  const [sendingReply, setSendingReply] = useState(false);

  const getStatusLabel = (status: string) => {
    if (status === "open") return t("support.contact.status.open");
    if (status === "in_progress") return t("support.contact.status.inProgress");
    if (status === "closed") return t("support.contact.status.closed");
    return status;
  };

  const formatDate = (s: string) => {
    try {
      const locale = i18n.language === "en" ? "en-GB" : "es-ES";
      return new Date(s).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
    } catch {
      return s;
    }
  };

  const fetchMyTickets = useCallback(async () => {
    setLoadingTickets(true);
    try {
      const { data, error } = await supabase.rpc("list_my_support_tickets");
      if (error) throw error;
      setMyTickets((data as MyTicketRow[]) || []);
    } catch (e) {
      console.error("[ContactSupportPage] Error listing tickets:", e);
      toast.error(t("support.contact.toasts.loadTicketsError"));
      setMyTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  }, [t]);

  useEffect(() => {
    if (currentAgency?.id) fetchMyTickets();
  }, [currentAgency?.id, fetchMyTickets]);

  useEffect(() => {
    if (!selectedTicketId) {
      setTicketDetail(null);
      setReplies([]);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    (async () => {
      try {
        const [detailRes, repliesRes] = await Promise.all([
          supabase.rpc("get_my_support_ticket", { p_ticket_id: selectedTicketId }),
          supabase.rpc("list_my_support_ticket_replies", { p_ticket_id: selectedTicketId }),
        ]);
        if (cancelled) return;
        if (detailRes.error) throw detailRes.error;
        if (repliesRes.error) throw repliesRes.error;
        const row = (detailRes.data as unknown[])?.[0];
        setTicketDetail(row ? (row as MyTicketRow) : null);
        setReplies((repliesRes.data as MyTicketReply[]) || []);
      } catch (e) {
        if (!cancelled) {
          console.error("[ContactSupportPage] Error loading ticket:", e);
          toast.error("Error al cargar el ticket");
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedTicketId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAgency?.id) {
      toast.error(t("support.contact.toasts.agencyRequired"));
      return;
    }
    if (!subject.trim()) {
      toast.error(t("support.contact.toasts.subjectRequired"));
      return;
    }
    if (subject.trim().length > INPUT_LIMITS.supportSubject) {
      toast.error(t("support.contact.toasts.subjectTooLong", { max: INPUT_LIMITS.supportSubject }));
      return;
    }
    if (!message.trim()) {
      toast.error(t("support.contact.toasts.messageRequired"));
      return;
    }
    if (message.trim().length > INPUT_LIMITS.supportMessage) {
      toast.error(t("support.contact.toasts.messageTooLong", { max: INPUT_LIMITS.supportMessage }));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.rpc("create_support_ticket_from_app", {
        p_agency_id: currentAgency.id,
        p_subject: subject.trim(),
        p_message: message.trim(),
      });
      if (error) throw error;
      setSent(true);
      setSubject("");
      setMessage("");
      setMessageKey((k) => k + 1);
      toast.success(t("support.contact.toasts.createSuccess"));
      fetchMyTickets();
    } catch (e: unknown) {
      console.error("[ContactSupportPage] Error:", e);
      toast.error(t("support.contact.toasts.createError"));
    } finally {
      setLoading(false);
    }
  };

  const sendReply = async () => {
    if (!selectedTicketId || !replyText?.trim()) {
      toast.error(t("support.contact.toasts.replyRequired"));
      return;
    }
    if (replyText.trim().length > INPUT_LIMITS.supportMessage) {
      toast.error(t("support.contact.toasts.messageTooLong", { max: INPUT_LIMITS.supportMessage }));
      return;
    }
    setSendingReply(true);
    try {
      const { error } = await supabase.rpc("add_support_ticket_reply_from_app", {
        p_ticket_id: selectedTicketId,
        p_message: replyText.trim(),
      });
      if (error) throw error;
      toast.success(t("support.contact.toasts.replySuccess"));
      setReplyText("");
      setReplyKey((k) => k + 1);
      const { data } = await supabase.rpc("list_my_support_ticket_replies", {
        p_ticket_id: selectedTicketId,
      });
      setReplies((data as MyTicketReply[]) || []);
    } catch (e: unknown) {
      console.error("[ContactSupportPage] Error sending reply:", e);
      toast.error(t("support.contact.toasts.replyError"));
    } finally {
      setSendingReply(false);
    }
  };

  if (!currentAgency) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-slate-600">
              {t("support.contact.noAgencySelected")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {t("support.contact.title")}
        </h1>
        <p className="text-slate-600 mt-1">
          {t("support.contact.subtitle", { agency: currentAgency.name })}
        </p>
      </div>

      {/* Nueva solicitud */}
      {!sent ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageCircle className="h-5 w-5 text-primary" />
              {t("support.contact.form.title")}
            </CardTitle>
            <CardDescription>
              {t("support.contact.form.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">
                  {t("support.contact.form.subjectLabel")}
                </Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t("support.contact.form.subjectPlaceholder")}
                  maxLength={INPUT_LIMITS.supportSubject}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">
                  {t("support.contact.form.messageLabel")}
                </Label>
                <SupportMessageEditor
                  key={messageKey}
                  id="message"
                  value={message}
                  onChange={setMessage}
                  placeholder={t("support.contact.form.messagePlaceholder")}
                  minHeight="140px"
                  maxLength={INPUT_LIMITS.supportMessage}
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {t("support.contact.form.submitting")}
                  </>
                ) : (
                  t("support.contact.form.submit")
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 flex flex-col items-center text-center gap-4">
            <CheckCircle className="h-12 w-12 text-emerald-500" />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {t("support.contact.form.successTitle")}
              </h2>
              <p className="text-slate-600 mt-1">
                {t("support.contact.form.successBody")}
              </p>
            </div>
            <Button variant="outline" onClick={() => setSent(false)}>
              {t("support.contact.form.successCta")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Mis tickets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {t("support.contact.tickets.title")}
          </CardTitle>
          <CardDescription>
            {t("support.contact.tickets.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingTickets ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : myTickets.length === 0 ? (
            <p className="text-slate-500 text-center py-6">
              {t("support.contact.tickets.empty")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {t("support.contact.tickets.columns.subject")}
                  </TableHead>
                  <TableHead>
                    {t("support.contact.tickets.columns.status")}
                  </TableHead>
                  <TableHead>
                    {t("support.contact.tickets.columns.createdAt")}
                  </TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {myTickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell>
                      <span className="font-medium">{ticket.subject}</span>
                      {ticket.message && (
                        <p className="text-xs text-slate-500 truncate max-w-[200px]" title={ticket.message}>
                          {ticket.message}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          ticket.status === "closed"
                            ? "secondary"
                            : ticket.status === "in_progress"
                              ? "default"
                              : "outline"
                        }
                      >
                        {getStatusLabel(ticket.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">{formatDate(ticket.created_at)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1"
                        onClick={() => setSelectedTicketId(ticket.id)}
                      >
                        <Eye className="h-4 w-4" />
                        {t("support.contact.tickets.view")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detalle del ticket (Sheet) */}
      <Sheet open={!!selectedTicketId} onOpenChange={(open) => !open && setSelectedTicketId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t("support.contact.detail.title")}</SheetTitle>
          </SheetHeader>
          {loadingDetail ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : ticketDetail ? (
            <div className="space-y-6 mt-6">
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-0.5">
                    {t("support.contact.detail.subjectLabel")}
                  </p>
                  <p className="font-medium text-slate-900">{ticketDetail.subject}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-0.5">
                    {t("support.contact.detail.initialMessageLabel")}
                  </p>
                  <SupportMessageContent content={ticketDetail.message} />
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200">
                  <Badge
                    variant={
                      ticketDetail.status === "closed"
                        ? "secondary"
                        : ticketDetail.status === "in_progress"
                          ? "default"
                          : "outline"
                    }
                  >
                    {getStatusLabel(ticketDetail.status)}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    {t("support.contact.detail.status.createdAtPrefix")}{" "}
                    {formatDate(ticketDetail.created_at)}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-sm font-semibold text-slate-800 mb-3">
                  {t("support.contact.detail.conversationTitle")}
                </h3>
                {replies.length === 0 ? (
                  <p className="text-slate-500 text-sm py-4">
                    {t("support.contact.detail.conversationEmpty")}
                  </p>
                ) : (
                  <ul className="space-y-4 mb-5">
                    {replies.map((r) => {
                      const isCurrentUser =
                        authUser?.email &&
                        (r.author_display === authUser.email ||
                          r.author_display?.toLowerCase() === authUser.email?.toLowerCase());
                      const displayName = isCurrentUser
                        ? t("support.contact.author.you")
                        : r.author_display ||
                          (r.is_from_support
                            ? t("support.contact.author.support")
                            : t("support.contact.author.you"));
                      return (
                        <li
                          key={r.id}
                          className={`flex gap-3 rounded-lg border p-3 text-sm ${
                            r.is_from_support
                              ? "border-primary/25 bg-primary/5"
                              : "border-slate-200 bg-slate-50/80"
                          }`}
                        >
                          <Avatar className="h-8 w-8 shrink-0 border border-slate-200">
                            <AvatarFallback
                              className={
                                r.is_from_support
                                  ? "bg-primary/20 text-primary text-xs"
                                  : "bg-slate-200 text-slate-600 text-xs"
                              }
                            >
                              {displayName[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-slate-800 mb-0.5">{displayName}</p>
                            <p className="text-xs text-slate-500 mb-1.5">{formatDate(r.created_at)}</p>
                            <SupportMessageContent content={r.message} className="text-slate-700 text-sm" />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {ticketDetail.status !== "closed" && (
                  <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
                    <SupportMessageEditor
                      key={replyKey}
                      value={replyText}
                      onChange={setReplyText}
                      placeholder={t("support.contact.detail.replyPlaceholder")}
                      minHeight="100px"
                      maxLength={INPUT_LIMITS.supportMessage}
                    />
                    <Button
                      size="sm"
                      onClick={sendReply}
                      disabled={sendingReply || !replyText?.trim()}
                      className="gap-1.5"
                    >
                      {sendingReply ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          {t("support.contact.detail.replyButton")}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-slate-500 py-8">
              {t("support.contact.detail.loadError")}
            </p>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
