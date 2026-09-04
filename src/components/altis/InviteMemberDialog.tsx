import { useState } from "react";
import { Copy, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAltis } from "@/lib/altis/store";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InviteMemberDialog({ kind }: { kind: "FORMATEUR" | "PARTICIPANT" }) {
  const { createMember, isOrgAdmin } = useAltis();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  if (!isOrgAdmin) return null;

  const label = kind === "FORMATEUR" ? "formateur" : "participant";

  const submit = async () => {
    if (form.firstName.trim().length < 2 || form.lastName.trim().length < 2) {
      setError("Prénom et nom sont obligatoires.");
      return;
    }
    if (!EMAIL_RE.test(form.email.trim())) {
      setError("Renseignez une adresse email valide.");
      return;
    }
    setPending(true);
    try {
      const member = await createMember({
        kind,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
      });
      setError(null);
      setForm({ firstName: "", lastName: "", email: "", phone: "" });
      setInviteLink(
        member.inviteToken
          ? `${window.location.origin}/invitation?token=${member.inviteToken}`
          : null,
      );
      toast.success(`${label.charAt(0).toUpperCase() + label.slice(1)} ajouté`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "La création a échoué.");
    } finally {
      setPending(false);
    }
  };

  const close = () => {
    setOpen(false);
    setInviteLink(null);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="size-4" aria-hidden /> Ajouter un {label}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau {label}</DialogTitle>
          <DialogDescription>
            Un lien d'invitation unique sera généré pour activer son compte.
          </DialogDescription>
        </DialogHeader>

        {inviteLink ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Transmettez ce lien d'activation à la personne concernée :
            </p>
            <div className="flex gap-2">
              <Input readOnly value={inviteLink} aria-label="Lien d'invitation" />
              <Button
                variant="outline"
                onClick={() => {
                  void navigator.clipboard?.writeText(inviteLink);
                  toast.success("Lien copié");
                }}
              >
                <Copy className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="member-first">Prénom</Label>
              <Input
                id="member-first"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="member-last">Nom</Label>
              <Input
                id="member-last"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="member-email">Email</Label>
              <Input
                id="member-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="member-phone">Téléphone (facultatif)</Label>
              <Input
                id="member-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
          </div>
        )}

        <DialogFooter>
          {inviteLink ? (
            <Button onClick={close}>Terminer</Button>
          ) : (
            <>
              <Button variant="outline" onClick={close}>
                Annuler
              </Button>
              <Button onClick={() => void submit()} disabled={pending}>
                Créer et générer le lien
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
