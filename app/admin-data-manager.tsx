"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminEntities, type AdminField } from "@/lib/admin-data-config";

type RecordRow = Record<string, unknown> & { id: string };
type Option = { id: string; label: string };

const initialValue = (field: AdminField): string | boolean => {
  if (field.type === "checkbox") return field.name === "active";
  if (field.name === "unit") return "kg";
  if (field.name === "currency") return "RWF";
  if (field.name === "country_code") return "RW";
  if (field.name === "verification_status") return "submitted";
  return "";
};
const formatValue = (value: unknown) => value === null || value === undefined || value === "" ? "—" : String(value).replaceAll("_", " ");

export default function AdminDataManager({ initialEntity = "crops" }: { initialEntity?: string }) {
  const [entity, setEntity] = useState(initialEntity);
  const [entityText, setEntityText] = useState(adminEntities[initialEntity]?.label ?? "Crops");
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [options, setOptions] = useState<Record<string, Option[]>>({});
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [editing, setEditing] = useState<RecordRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const config = adminEntities[entity];
  const fields = config.fields;
  const columns = useMemo(() => fields.filter((field) => !["notes", "source_reference", "farm_id", "season_id", "cultivated_area_ha"].includes(field.name)).slice(0, 7), [fields]);

  const load = useCallback(async (kind: string) => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/data?entity=${encodeURIComponent(kind)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load records.");
      setRecords(data.records); setOptions(data.options);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load records."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`/api/admin/data?entity=${encodeURIComponent(entity)}`, { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!active) return;
        if (!response.ok) throw new Error(data.error ?? "Could not load records.");
        setRecords(data.records); setOptions(data.options); setLoading(false);
      })
      .catch((cause: unknown) => { if (active) { setError(cause instanceof Error ? cause.message : "Could not load records."); setLoading(false); } });
    return () => { active = false; };
  }, [entity]);

  function startEdit(row: RecordRow) {
    setEditing(row); setMessage(""); setError("");
    setForm(Object.fromEntries(fields.map((field) => {
      const value = row[field.name];
      if (field.reference && value !== null && value !== undefined) {
        const reference = options[field.reference]?.find((option) => option.id === String(value));
        return [field.name, reference?.label ?? ""];
      }
      return [field.name, field.type === "checkbox" ? Boolean(value) : value === null || value === undefined ? "" : String(value).slice(0, field.type === "date" ? 10 : undefined)];
    })));
    document.getElementById("admin-data-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetForm() {
    setEditing(null); setForm(Object.fromEntries(fields.map((field) => [field.name, initialValue(field)]))); setMessage("");
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const values: Record<string, string | boolean> = { ...form };
      for (const field of fields) {
        if (!field.reference || !String(form[field.name] ?? "").trim()) continue;
        const match = options[field.reference]?.find((option) => option.label.toLocaleLowerCase() === String(form[field.name]).trim().toLocaleLowerCase());
        if (!match) throw new Error(`${field.label} must match one of the listed records below the field.`);
        values[field.name] = match.id;
      }
      const response = await fetch("/api/admin/data", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entity, id: editing?.id, values }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save record.");
      const success = editing ? "Record updated and added to the audit trail." : "Record created and added to the audit trail.";
      resetForm(); setMessage(success); await load(entity);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save record."); }
    finally { setSaving(false); }
  }

  async function remove(row: RecordRow) {
    if (!window.confirm("Delete this record? The action will be recorded in the audit trail. Linked records cannot be removed.")) return;
    setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/data", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entity, id: row.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not delete record.");
      if (editing?.id === row.id) resetForm();
      setMessage("Record deleted and added to the audit trail."); await load(entity);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete record."); }
  }

  function changeEntityName(value: string) {
    setEntityText(value);
    const normalized = value.trim().toLocaleLowerCase();
    const match = Object.entries(adminEntities).find(([key, item]) => key.toLocaleLowerCase() === normalized || item.label.toLocaleLowerCase() === normalized);
    if (!match) return;
    const next = match[0];
    setLoading(true); setEntity(next); setForm(Object.fromEntries(adminEntities[next].fields.map((field) => [field.name, initialValue(field)]))); setEditing(null); setError(""); setMessage("");
  }

  return <div className="admin-data-workspace">
    <section className="panel glass-panel admin-data-toolbar"><div><p className="eyebrow">DATABASE RECORDS</p><h2>Manage data</h2><p className="panel-copy">Changes are saved directly to the database and recorded in the audit trail.</p></div><label className="entity-picker">Data set<input type="text" value={entityText} onChange={(event) => changeEntityName(event.target.value)} placeholder="Type a data set name"/><small>Type crops, locations, organizations, seasons, farms, harvest reports, availability records, marketplace listings, or marketplace orders.</small></label></section>
    {(error || message) && <p className={`auth-message ${error ? "error" : "success"}`} role={error ? "alert" : "status"}>{error || message}</p>}
    <div className="admin-data-grid">
      <section className="panel glass-panel route-panel admin-records"><div className="panel-header"><div><p className="eyebrow">DATABASE RECORDS</p><h2>{config.label}</h2></div><button className="refresh-button" disabled={loading} onClick={() => void load(entity)}>↻ Refresh</button></div>
        {loading ? <div className="admin-empty">Loading records from Neon…</div> : records.length === 0 ? <div className="empty-state"><span className="empty-icon">⌑</span><strong>No {config.label.toLowerCase()} yet</strong><p>Create the first record using the form.</p></div> : <div className="admin-record-list">{records.map((row) => <article className="admin-record-row" key={row.id}><div className="admin-record-main"><strong>{recordTitle(row, entity)}</strong><small>{columns.map((field) => `${field.label}: ${formatValue(row[field.name])}`).join(" · ")}</small></div><div className="admin-record-actions"><button className="refresh-button" onClick={() => startEdit(row)}>Edit</button><button className="reject-button" onClick={() => void remove(row)}>Delete</button></div></article>)}</div>}
        <p className="route-note">Showing the latest 100 records. Records referenced by other data cannot be deleted.</p>
      </section>
      <section className="panel glass-panel route-panel admin-data-form-panel" id="admin-data-form"><div className="panel-header"><div><p className="eyebrow">{editing ? "EDIT RECORD" : "NEW RECORD"}</p><h2>{editing ? "Update " : "Add "}{config.label.toLowerCase()}</h2></div></div>
        {fields.some((field) => field.reference && !(options[field.reference]?.length)) && <p className="auth-message error setup-hint">This form needs linked records first. Create the required crops, locations, organizations, or seasons using the text data set field above, then return here.</p>}
        <form className="admin-data-form" onSubmit={save}>{fields.map((field) => <Field key={field.name} field={field} value={form[field.name] ?? initialValue(field)} options={field.reference ? options[field.reference] ?? [] : []} onChange={(value) => setForm((current) => ({ ...current, [field.name]: value }))}/>)}
          <div className="admin-form-actions"><button className="primary-button" disabled={saving || fields.some((field) => field.required && field.reference && !(options[field.reference]?.length))}>{saving ? "Saving…" : editing ? "Save changes" : "Create record"}</button>{editing && <button type="button" className="refresh-button" onClick={resetForm}>Cancel edit</button>}</div>
        </form><p className="route-note">Administrative changes are attributed to your account. Verified records include your verification identity and timestamp.</p>
      </section>
    </div>
  </div>;
}

function Field({ field, value, options, onChange }: { field: AdminField; value: string | boolean; options: Option[]; onChange: (value: string | boolean) => void }) {
  if (field.type === "checkbox") return <label className="admin-check-field"><input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)}/>{field.label}</label>;
  const common = { required: field.required, value: String(value), onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value), placeholder: field.reference ? `Type ${field.label.toLocaleLowerCase()}` : field.options ? `Type a ${field.label.toLocaleLowerCase()}` : undefined };
  const matches = options.filter((option) => !String(value).trim() || option.label.toLocaleLowerCase().includes(String(value).trim().toLocaleLowerCase())).slice(0,8);
  return <label className="admin-data-field">{field.label}<input {...common} type={field.type === "number" ? "number" : field.type === "reference" ? "text" : field.type} min={field.type === "number" ? "0" : undefined} step={field.type === "number" ? "any" : undefined}/>{field.reference&&<small className="field-hint">{options.length ? String(value).trim() ? `Matching records: ${matches.map((option)=>option.label).join("; ") || "no match"}${matches.length===8?"; type more to narrow results":""}` : `${options.length} linked records available. Type part of a name to find a match.` : "No linked records yet. Add them first using the data set field."}</small>}{field.options&&<small className="field-hint">Type one of: {field.options.map((option)=>option.label).join(", ")}</small>}</label>;
}

function recordTitle(row: RecordRow, entity: string) {
  if (entity === "geographies") return [row.district_name,row.sector_name,row.cell_name,row.village_name].filter(Boolean).join(" · ");
  if (entity === "seasons") return `${row.name} · ${String(row.starts_on).slice(0,10)}`;
  if (entity === "harvest_reports") return `${row.report_type} · ${row.quantity_kg} kg`;
  if (entity === "inventory_balances") return `${row.available_kg} kg available`;
  if (entity === "marketplace_listings") return `${row.available_quantity} ${row.unit} · ${row.status}`;
  if (entity === "marketplace_orders") return `${row.quantity} · ${row.status}`;
  return String(row.name ?? row.id);
}
