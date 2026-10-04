import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, Save, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { TemplateThumbnail } from "./TemplateThumbnail";
import {
  applicationDraftSchema,
  applicationInputSchema,
  type ApplicationInput,
} from "../shared/schema";
import { defaultDocumentDesign } from "../shared/documentDesign";
import { colorPresets, templates } from "../shared/templates";
import { useAppStore } from "../store/useAppStore";

type Props = {
  onClose: () => void;
};

const defaults: ApplicationInput = {
  company: {
    name: "",
    street: "",
    postalCode: "",
    city: "",
    country: "Deutschland",
    website: "",
  },
  contact: {
    salutation: "",
    firstName: "",
    lastName: "",
    position: "",
    email: "",
    phone: "",
  },
  job: {
    title: "",
    reference: "",
    source: "",
    url: "",
    fullText: "",
    workModel: "Hybrid",
    contractType: "Unbefristet",
    salaryExpectation: "",
  },
  templateId: templates[0].id,
  accentColor: templates[0].accent,
  secondaryColor: templates[0].secondary,
  designSettings: defaultDocumentDesign,
  additionalContacts: [],
  notes: "",
};

const mergeDraft = (draft: unknown): ApplicationInput => {
  const result = applicationDraftSchema.safeParse(draft);
  if (!result.success) return defaults;
  return {
    ...defaults,
    ...result.data,
    company: { ...defaults.company, ...result.data.company },
    contact: { ...defaults.contact, ...result.data.contact },
    job: { ...defaults.job, ...result.data.job },
    designSettings: {
      ...defaults.designSettings,
      ...result.data.designSettings,
    },
  };
};

export function NewApplicationWizard({ onClose }: Props) {
  const [step, setStep] = useState(1);
  const [draftReady, setDraftReady] = useState(false);
  const [showSecondContact, setShowSecondContact] = useState(false);
  const completedRef = useRef(false);
  const createApplication = useAppStore((state) => state.createApplication);
  const profiles = useAppStore((state) => state.workspace.profiles);
  const autoSaveDelaySeconds = useAppStore(
    (state) => state.workspace.settings.autoSaveDelaySeconds,
  );
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<ApplicationInput>({
    resolver: zodResolver(applicationInputSchema) as Resolver<ApplicationInput>,
    defaultValues: defaults,
  });
  const selectedTemplateId = watch("templateId");
  const sentAt = watch("sentAt");
  const deadlineAt = watch("deadlineAt");
  const primaryContact = watch("contact");
  const secondContact = watch("additionalContacts.0");
  const selectedTemplate = useMemo(
    () =>
      templates.find((template) => template.id === selectedTemplateId) ??
      templates[0],
    [selectedTemplateId],
  );

  useEffect(() => {
    let active = true;
    void window.bewerbungsManager.applicationDraft.get().then((draft) => {
      if (!active) return;
      const mergedDraft = mergeDraft(draft);
      reset(mergedDraft);
      setShowSecondContact(Boolean(mergedDraft.additionalContacts?.length));
      setDraftReady(true);
    });
    return () => {
      active = false;
    };
  }, [reset]);

  useEffect(() => {
    if (!draftReady) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let latestValue: unknown;
    const saveDraft = (value: unknown) => {
      const result = applicationDraftSchema.safeParse(value);
      if (result.success) {
        void window.bewerbungsManager.applicationDraft.save(result.data);
      }
    };
    const subscription = watch((value) => {
      latestValue = value;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        saveDraft(value);
      }, autoSaveDelaySeconds * 1_000);
    });
    return () => {
      subscription.unsubscribe();
      if (timer) clearTimeout(timer);
      if (!completedRef.current && latestValue) {
        saveDraft(latestValue);
      }
    };
  }, [autoSaveDelaySeconds, draftReady, watch]);

  const next = async () => {
    const fields =
      step === 1
        ? (["company.name", "company.city", "job.title"] as const)
        : step === 2
          ? (["contact.email", "job.url", "company.website"] as const)
          : [];
    if (fields.length && !(await trigger(fields))) return;
    if (
      step === 2 &&
      showSecondContact &&
      !(await trigger("additionalContacts.0.email"))
    ) {
      return;
    }
    setStep((current) => Math.min(4, current + 1));
  };

  const submit = handleSubmit(async (input) => {
    await createApplication(input);
    completedRef.current = true;
    await window.bewerbungsManager.applicationDraft.clear();
    onClose();
  });

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="wizard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wizard-title">
        <header className="wizard-header">
          <div>
            <p className="eyebrow">Neue Bewerbung</p>
            <h2 id="wizard-title">
              {step === 1 && "Stelle & Unternehmen"}
              {step === 2 && "Kontakt & Termine"}
              {step === 3 && "Design auswählen"}
              {step === 4 && "Prüfen & anlegen"}
            </h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Schließen">
            <X size={19} />
          </button>
        </header>
        <div className="stepper" aria-label={`Schritt ${step} von 4`}>
          {[1, 2, 3, 4].map((number) => (
            <span key={number} className={number <= step ? "active" : ""}>
              {number < step ? <Check size={14} /> : number}
            </span>
          ))}
        </div>
        <form onSubmit={submit}>
          <div className="wizard-body">
            {step === 1 && (
              <div className="form-grid">
                <label className="field">
                  <span>Unternehmen *</span>
                  <input autoFocus {...register("company.name")} />
                  <small>{errors.company?.name?.message}</small>
                </label>
                <label className="field">
                  <span>Position *</span>
                  <input {...register("job.title")} />
                  <small>{errors.job?.title?.message}</small>
                </label>
                <label className="field">
                  <span>Straße</span>
                  <input {...register("company.street")} />
                </label>
                <div className="split-fields">
                  <label className="field">
                    <span>PLZ</span>
                    <input {...register("company.postalCode")} />
                  </label>
                  <label className="field">
                    <span>Ort *</span>
                    <input {...register("company.city")} />
                    <small>{errors.company?.city?.message}</small>
                  </label>
                </div>
                <label className="field">
                  <span>Arbeitsmodell</span>
                  <select {...register("job.workModel")}>
                    <option>Vor Ort</option>
                    <option>Hybrid</option>
                    <option>Remote</option>
                  </select>
                </label>
                <label className="field">
                  <span>Vertragsart</span>
                  <select {...register("job.contractType")}>
                    <option>Unbefristet</option>
                    <option>Befristet</option>
                    <option>Praktikum</option>
                    <option>Ausbildung</option>
                    <option>Werkstudent</option>
                    <option>Freelance</option>
                  </select>
                </label>
                <label className="field full">
                  <span>Stellenanzeige</span>
                  <textarea rows={6} {...register("job.fullText")} />
                </label>
              </div>
            )}
            {step === 2 && (
              <div className="form-grid">
                <label className="field">
                  <span>Anrede</span>
                  <select {...register("contact.salutation")}>
                    <option value="">Nicht bekannt</option>
                    <option>Frau</option>
                    <option>Herr</option>
                    <option>Divers</option>
                  </select>
                </label>
                <div className="split-fields">
                  <label className="field">
                    <span>Vorname</span>
                    <input {...register("contact.firstName")} />
                  </label>
                  <label className="field">
                    <span>Nachname</span>
                    <input {...register("contact.lastName")} />
                  </label>
                </div>
                <label className="field">
                  <span>E-Mail</span>
                  <input type="email" {...register("contact.email")} />
                  <small>{errors.contact?.email?.message}</small>
                </label>
                <label className="field">
                  <span>Telefon</span>
                  <input {...register("contact.phone")} />
                </label>
                <label className="field">
                  <span>Position / Funktion</span>
                  <input {...register("contact.position")} />
                </label>
                {showSecondContact ? (
                  <>
                    <div className="contact-person-heading full">
                      <strong>Zweiter Ansprechpartner</strong>
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => {
                          setValue("additionalContacts", []);
                          setShowSecondContact(false);
                        }}>
                        Entfernen
                      </button>
                    </div>
                    <label className="field">
                      <span>Anrede / Geschlecht</span>
                      <select {...register("additionalContacts.0.salutation")}>
                        <option value="">Nicht bekannt</option>
                        <option>Frau</option>
                        <option>Herr</option>
                        <option>Divers</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Position / Funktion</span>
                      <input {...register("additionalContacts.0.position")} />
                    </label>
                    <label className="field">
                      <span>Vorname</span>
                      <input {...register("additionalContacts.0.firstName")} />
                    </label>
                    <label className="field">
                      <span>Nachname</span>
                      <input {...register("additionalContacts.0.lastName")} />
                    </label>
                    <label className="field">
                      <span>E-Mail</span>
                      <input
                        type="email"
                        {...register("additionalContacts.0.email")}
                      />
                      <small>
                        {errors.additionalContacts?.[0]?.email?.message}
                      </small>
                    </label>
                    <label className="field">
                      <span>Telefon</span>
                      <input {...register("additionalContacts.0.phone")} />
                    </label>
                  </>
                ) : (
                  <div className="contact-person-add full">
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => {
                        setValue("additionalContacts", [
                          {
                            salutation: "",
                            firstName: "",
                            lastName: "",
                            position: "",
                            email: "",
                            phone: "",
                          },
                        ]);
                        setShowSecondContact(true);
                      }}>
                      Zweiten Ansprechpartner hinzufügen
                    </button>
                  </div>
                )}
                <label className="field">
                  <span>Bewerbungsdatum</span>
                  <input
                    type="date"
                    value={sentAt?.slice(0, 10) ?? ""}
                    onChange={(event) =>
                      setValue(
                        "sentAt",
                        event.target.value
                          ? new Date(
                              `${event.target.value}T09:00:00`,
                            ).toISOString()
                          : undefined,
                      )
                    }
                  />
                </label>
                <label className="field">
                  <span>Bewerbungsfrist</span>
                  <input
                    type="date"
                    value={deadlineAt?.slice(0, 10) ?? ""}
                    onChange={(event) =>
                      setValue(
                        "deadlineAt",
                        event.target.value
                          ? new Date(
                              `${event.target.value}T18:00:00`,
                            ).toISOString()
                          : undefined,
                      )
                    }
                  />
                </label>
                <label className="field">
                  <span>Kennziffer / Referenznummer</span>
                  <input
                    placeholder="z. B. ABC-123"
                    {...register("job.reference")}
                  />
                </label>
                <label className="field">
                  <span>Quelle</span>
                  <input
                    placeholder="z. B. LinkedIn"
                    {...register("job.source")}
                  />
                </label>
                <label className="field">
                  <span>Stellen-URL</span>
                  <input type="url" {...register("job.url")} />
                  <small>{errors.job?.url?.message}</small>
                </label>
                <label className="field">
                  <span>Website</span>
                  <input type="url" {...register("company.website")} />
                  <small>{errors.company?.website?.message}</small>
                </label>
                <label className="field">
                  <span>Absenderprofil</span>
                  <select
                    {...register("profileId", {
                      setValueAs: (value) => value || undefined,
                    })}>
                    <option value="">Standardprofil</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.firstName} {profile.lastName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Gehaltsvorstellung</span>
                  <input
                    placeholder="z. B. 58.500 € brutto/Jahr"
                    {...register("job.salaryExpectation")}
                  />
                </label>
              </div>
            )}
            {step === 3 && (
              <div className="template-grid">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className={`template-choice ${template.id === selectedTemplate.id ? "selected" : ""}`}
                    onClick={() => {
                      setValue("templateId", template.id);
                      setValue("accentColor", template.accent);
                      setValue("secondaryColor", template.secondary);
                    }}>
                    <TemplateThumbnail
                      template={template}
                      accent={watch("accentColor")}
                      secondary={watch("secondaryColor")}
                    />
                    <strong>{template.name}</strong>
                    <small>{template.description}</small>
                  </button>
                ))}
                <div className="design-colors">
                  <span>Farbwelten</span>
                  <div className="color-preset-row">
                    {colorPresets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        title={preset.name}
                        aria-label={preset.name}
                        style={
                          {
                            "--preset-accent": preset.accent,
                            "--preset-secondary": preset.secondary,
                          } as React.CSSProperties
                        }
                        onClick={() => {
                          setValue("accentColor", preset.accent);
                          setValue("secondaryColor", preset.secondary);
                        }}
                      />
                    ))}
                  </div>
                  <div className="color-input-row">
                    <label className="field accent-field">
                      <span>Akzent</span>
                      <input type="color" {...register("accentColor")} />
                    </label>
                    <label className="field accent-field">
                      <span>Seitenfläche</span>
                      <input type="color" {...register("secondaryColor")} />
                    </label>
                  </div>
                </div>
              </div>
            )}
            {step === 4 && (
              <div className="review-card">
                <span
                  className="review-logo"
                  style={{ background: watch("accentColor") }}>
                  {watch("company.name").slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <p className="eyebrow">Bereit zum Anlegen</p>
                  <h3>{watch("job.title")}</h3>
                  <p>
                    {watch("company.name")} · {watch("company.city")}
                  </p>
                  <dl>
                    <div>
                      <dt>Arbeitsmodell</dt>
                      <dd>{watch("job.workModel")}</dd>
                    </div>
                    <div>
                      <dt>Vorlage</dt>
                      <dd>{selectedTemplate.name}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{watch("sentAt") ? "Beworben" : "Entwurf"}</dd>
                    </div>
                    <div>
                      <dt>1. Ansprechpartner</dt>
                      <dd>
                        {[primaryContact.firstName, primaryContact.lastName]
                          .filter(Boolean)
                          .join(" ") || "Nicht angegeben"}
                      </dd>
                    </div>
                    {secondContact ? (
                      <div>
                        <dt>2. Ansprechpartner</dt>
                        <dd>
                          {[secondContact.firstName, secondContact.lastName]
                            .filter(Boolean)
                            .join(" ") || "Nicht angegeben"}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              </div>
            )}
          </div>
          <footer className="wizard-footer">
            <button
              className="button secondary"
              type="button"
              onClick={() =>
                step === 1 ? onClose() : setStep((current) => current - 1)
              }>
              <ArrowLeft size={17} /> {step === 1 ? "Abbrechen" : "Zurück"}
            </button>
            <span className="autosave-hint">
              <Save size={14} /> Entwurf wird automatisch gespeichert
            </span>
            {step < 4 ? (
              <button
                className="button primary"
                type="button"
                onClick={() => void next()}>
                Weiter <ArrowRight size={17} />
              </button>
            ) : (
              <button
                className="button primary"
                type="submit"
                disabled={isSubmitting}>
                <Check size={17} /> Bewerbung anlegen
              </button>
            )}
          </footer>
        </form>
      </section>
    </div>
  );
}
