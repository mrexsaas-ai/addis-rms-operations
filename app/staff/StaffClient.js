"use client";

import { useState, useTransition } from "react";
import { createStaff } from "./actions";

const roles = [
  { value: "SERVER", label: "Server" },
  { value: "CHEF", label: "Chef" },
  { value: "BARMAN", label: "Barman" },
  { value: "MANAGER", label: "Manager" },
];

export default function StaffClient() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    setMessage("");

    startTransition(async () => {
      try {
        const result = await createStaff(formData);

        form.reset();
        setOpen(false);
        setMessage(result.message);

        window.location.reload();
      } catch (error) {
        setMessage(
          error?.message ||
            "Could not create staff member."
        );
      }
    });
  }

  return (
    <>
      <button
        type="button"
        className="primary-button"
        onClick={() => {
          setMessage("");
          setOpen(true);
        }}
      >
        + Add staff
      </button>

      {message && !open && (
        <div className="staff-message">
          {message}
        </div>
      )}

      {open && (
        <div
          className="staff-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !isPending
            ) {
              setOpen(false);
            }
          }}
        >
          <div className="staff-modal">
            <div className="staff-modal-header">
              <div>
                <p className="eyebrow">
                  Staff management
                </p>

                <h2>Add staff member</h2>
              </div>

              <button
                type="button"
                className="staff-modal-close"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                ×
              </button>
            </div>

            <form
              className="staff-form"
              onSubmit={handleSubmit}
            >
              {/* BASIC INFORMATION */}
              <div className="staff-form-grid">
                <label>
                  <span>Full name</span>

                  <input
                    name="full_name"
                    type="text"
                    placeholder="Enter full name"
                    required
                  />
                </label>

                <label>
                  <span>Email</span>

                  <input
                    name="email"
                    type="email"
                    placeholder="staff@example.com"
                    required
                  />
                </label>

                <label>
                  <span>Password</span>

                  <input
                    name="password"
                    type="password"
                    placeholder="Minimum 6 characters"
                    minLength={6}
                    required
                  />
                </label>

                <label>
                  <span>Role</span>

                  <select
                    name="role"
                    defaultValue="SERVER"
                    required
                  >
                    {roles.map((role) => (
                      <option
                        key={role.value}
                        value={role.value}
                      >
                        {role.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* SHIFT */}
              <div className="shift-section">
                <div className="shift-title">
                  <span>Work shift</span>
                  <small>Optional</small>
                </div>

                <div className="shift-form-grid">
                  <label>
                    <span>Shift date</span>

                    <input
                      name="shift_date"
                      type="date"
                    />
                  </label>

                  <label>
                    <span>Start time</span>

                    <input
                      name="start_time"
                      type="time"
                    />
                  </label>

                  <label>
                    <span>End time</span>

                    <input
                      name="end_time"
                      type="time"
                    />
                  </label>
                </div>
              </div>

              {message && (
                <div className="staff-form-error">
                  {message}
                </div>
              )}

              <div className="staff-form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={isPending}
                >
                  {isPending
                    ? "Creating..."
                    : "Create staff"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}