// Rótulo + input controlado. O input fica dentro do <label> de propósito:
// getByLabelText encontra a associação implícita sem precisar de id/htmlFor.
type Props = {
  label: string;
  value: string;
  onChange(value: string): void;
  type?: string;
  name?: string;
  autoComplete?: string;
  helpText?: string;
};

export function Field({ label, value, onChange, type = "text", name, autoComplete, helpText }: Props) {
  return (
    // helpText fica FORA do <label>: o nome acessível do input é o texto do
    // label que o envolve, e se o texto de ajuda estivesse dentro dele
    // getByLabelText(label) deixaria de casar (o nome viraria "label + ajuda").
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--ink2)" }}>
        <span>{label}</span>
        <input
          type={type}
          name={name}
          value={value}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          style={{
            padding: "8px 10px",
            border: "1px solid var(--rule2)",
            borderRadius: 6,
            background: "var(--panel)",
            color: "var(--ink)",
            fontSize: 13
          }}
        />
      </label>
      {helpText && <small style={{ color: "var(--ink3)", fontSize: 11 }}>{helpText}</small>}
    </div>
  );
}
