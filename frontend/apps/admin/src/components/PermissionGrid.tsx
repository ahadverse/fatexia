import { MANAGER_PERMISSION_GROUPS, MANAGER_PERMISSION_KEYS } from '@fatexia/types';
import type { ManagerPermission, ManagerPermissions } from '@fatexia/types';

/**
 * Issue #20 — the checkbox grid an admin uses to decide what a manager may do.
 *
 * Emits a complete grid on every change, never a patch: the server replaces the
 * stored set wholesale, which is what makes un-ticking a box actually revoke
 * something. Sending only the ticked keys as a merge would make permissions
 * one-way.
 */
export interface PermissionGridProps {
  value: ManagerPermissions;
  onChange: (permissions: ManagerPermissions) => void;
  disabled?: boolean;
}

function countGranted(value: ManagerPermissions): number {
  return MANAGER_PERMISSION_KEYS.filter((key) => value[key] === true).length;
}

export function PermissionGrid({ value, onChange, disabled }: PermissionGridProps) {
  function toggle(permission: ManagerPermission, checked: boolean) {
    const next = { ...value };
    // Deleting rather than storing `false` keeps one representation of "not granted",
    // matching how the server normalises the payload back.
    if (checked) next[permission] = true;
    else delete next[permission];
    onChange(next);
  }

  function setAll(checked: boolean) {
    onChange(checked ? Object.fromEntries(MANAGER_PERMISSION_KEYS.map((key) => [key, true])) : {});
  }

  const granted = countGranted(value);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {granted === 0
            ? 'Nothing granted — this manager can sign in and see the dashboard, nothing else.'
            : `${granted} of ${MANAGER_PERMISSION_KEYS.length} granted.`}
        </p>
        <div className="flex gap-3 text-xs">
          <button type="button" disabled={disabled} onClick={() => setAll(true)} className="font-medium text-primary hover:underline disabled:opacity-50">
            Select all
          </button>
          <button type="button" disabled={disabled} onClick={() => setAll(false)} className="font-medium text-muted-foreground hover:underline disabled:opacity-50">
            Clear all
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {MANAGER_PERMISSION_GROUPS.map((group) => (
          <fieldset key={group.label} className="rounded-md border border-border p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</legend>
            <div className="space-y-2">
              {group.permissions.map((permission) => (
                <label key={permission.key} className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 text-sm hover:bg-accent">
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={value[permission.key] === true}
                    onChange={(event) => toggle(permission.key, event.target.checked)}
                    className="mt-0.5 size-3.5 accent-[hsl(var(--primary))]"
                  />
                  <span>
                    <span className="text-card-foreground">{permission.label}</span>
                    {permission.hint && <span className="mt-0.5 block text-xs text-muted-foreground">{permission.hint}</span>}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  );
}
