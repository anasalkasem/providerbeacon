import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAdminText } from "@/i18n/admin";
import type { LinkMetadata } from "@shared/linkMetadata";
import { useLocale } from "@/contexts/LocaleContext";
import { providerProfileCopy } from "@/i18n/providerProfile";
import { websiteHome } from "@shared/linkMetadata";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import LinkAutofill from "./LinkAutofill";

export default function ProviderDraftFields({
  pending,
  onCreate,
}: {
  pending: boolean;
  onCreate: (value: {
    name: string;
    websiteUrl: string;
    metadataKey?: string;
  }) => void;
}) {
  const text = useAdminText();
  const { locale } = useLocale();
  const [website, setWebsite] = useState("");
  const [name, setName] = useState("");
  const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
  const [fetching, setFetching] = useState(false);
  const nameEdited = useRef(false);
  const matching =
    metadata?.sourceUrl === websiteHome(website) ? metadata : null;
  return (
    <fieldset
      disabled={pending}
      className="grid min-w-0 gap-3 rounded-xl border border-input bg-secondary/70 p-4 md:col-span-2 md:grid-cols-2 disabled:opacity-60"
    >
      <label className="grid min-w-0 gap-2 text-sm font-bold text-secondary-foreground">
        <span>{providerProfileCopy[locale].websiteUrl}</span>
        <Input
          dir="ltr"
          type="url"
          maxLength={500}
          value={website}
          onChange={e => {
            if (websiteHome(e.target.value) !== websiteHome(website)) {
              setMetadata(null);
              if (!nameEdited.current) setName("");
            }
            setWebsite(e.target.value);
          }}
          placeholder="https://provider.example"
        />
      </label>
      <label className="grid min-w-0 gap-2 text-sm font-bold text-secondary-foreground">
        <span>{text("providerName")}</span>
        <Input
          value={name}
          minLength={2}
          maxLength={200}
          onChange={e => {
            nameEdited.current = true;
            setName(e.target.value);
          }}
        />
      </label>
      <LinkAutofill
        kind="website"
        url={website}
        onPending={setFetching}
        onResolved={value => {
          setMetadata(value);
          if (!nameEdited.current && value.name) setName(value.name);
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="justify-self-start"
        disabled={
          pending || fetching || name.trim().length < 2 || !websiteHome(website)
        }
        onClick={() =>
          onCreate({ name, websiteUrl: website, metadataKey: matching?.key })
        }
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        {text("createProvider")}
      </Button>
    </fieldset>
  );
}
