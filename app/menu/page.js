import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createCategory,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
} from "./actions";
import MenuFilters from "./MenuFilters";

export const dynamic = "force-dynamic";

const roles = {
  ADMIN: "Admin",
  OWNER: "Owner",
  MANAGER: "Manager",
  SERVER: "Server",
  CHEF: "Chef",
  BARMAN: "Barman",
};

function formatETB(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "ETB",
    currencyDisplay: "code",
  }).format(Number(value || 0));
}

export default async function MenuPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership, error: membershipError } = await supabase
    .from("restaurant_users")
    .select("restaurant_id, role, restaurants(name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!membership) {
    return (
      <main className="state-page">
        <div className="state-panel">
          <span className="brand-mark">ADDIS RMS</span>
          <p className="eyebrow">MENU MANAGEMENT</p>
          <h1>Access not granted.</h1>
          <p>Your account is not connected to a restaurant.</p>
        </div>
      </main>
    );
  }

  const restaurant = Array.isArray(membership.restaurants)
    ? membership.restaurants[0]
    : membership.restaurants;

  const [{ data: categories, error: categoriesError }, { data: items, error: itemsError }] =
    await Promise.all([
      supabase
        .from("categories")
        .select("id, name")
        .eq("restaurant_id", membership.restaurant_id)
        .order("name", { ascending: true }),

      supabase
        .from("menu_items")
        .select(
          "id, category_id, name, description, price, image_url, is_available"
          + ", station"
        )
        .eq("restaurant_id", membership.restaurant_id)
        .order("created_at", { ascending: false }),
    ]);

  if (categoriesError) throw new Error(categoriesError.message);
  if (itemsError) throw new Error(itemsError.message);

  const categoryList = categories || [];
  const menuItems = items || [];
  const canManage = ["ADMIN", "OWNER", "MANAGER"].includes(membership.role);

  const categoryMap = Object.fromEntries(
    categoryList.map((category) => [category.id, category.name])
  );

  return (
    <main className="menu-page">
      <style>{`
        .menu-page {
          min-height: 100vh;
          background: #0a0a0b;
          color: #f5f5f5;
          padding: 28px;
        }

        .menu-wrap {
          max-width: 1240px;
          margin: 0 auto;
        }

        .menu-topbar {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 28px;
        }

        .brand-mark {
          font-weight: 800;
          letter-spacing: .14em;
        }

        .eyebrow {
          margin: 0 0 8px;
          font-size: 11px;
          letter-spacing: .14em;
          text-transform: uppercase;
          opacity: .55;
        }

        .menu-topbar h1 {
          margin: 0;
          font-size: clamp(30px, 5vw, 48px);
          letter-spacing: -.04em;
        }

        .subtle {
          margin-top: 8px;
          color: #999;
        }

        .menu-actions {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .menu-cta {
          background: #d8ff45;
          color: #101010;
          border: 0;
          border-radius: 10px;
          padding: 11px 15px;
          font-weight: 800;
        }

        .catalog-toolbar {
          display: grid;
          gap: 16px;
          margin-bottom: 18px;
          padding: 16px;
          border: 1px solid #27272a;
          border-radius: 16px;
          background: #111113;
        }

        .catalog-search span {
          display: block;
          margin-bottom: 7px;
          color: #aaa;
          font-size: 12px;
          font-weight: 700;
        }

        .catalog-search input {
          width: 100%;
          box-sizing: border-box;
          padding: 13px 14px;
          border: 1px solid #303033;
          border-radius: 10px;
          background: #09090a;
          color: #fff;
          font: inherit;
        }

        .filter-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .filter-chip {
          border: 1px solid #303033;
          border-radius: 999px;
          padding: 8px 11px;
          background: transparent;
          color: #aaa;
          cursor: pointer;
          font: inherit;
          font-size: 12px;
        }

        .filter-chip span {
          color: #777;
          margin-left: 4px;
        }

        .filter-chip.active {
          border-color: #d8ff45;
          background: #d8ff45;
          color: #101010;
        }

        .filter-chip.active span {
          color: #101010;
        }

        .back-link {
          text-decoration: none;
          color: white;
          border: 1px solid #303033;
          border-radius: 10px;
          padding: 10px 14px;
        }

        .layout {
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 18px;
          align-items: start;
        }

        .panel,
        .item-card {
          background: #111113;
          border: 1px solid #27272a;
          border-radius: 16px;
        }

        .panel {
          padding: 20px;
          margin-bottom: 18px;
        }

        .panel h2 {
          margin: 0 0 16px;
          font-size: 18px;
        }

        .field {
          margin-bottom: 13px;
        }

        .field label {
          display: block;
          margin-bottom: 7px;
          color: #aaa;
          font-size: 12px;
        }

        .field input,
        .field textarea,
        .field select {
          box-sizing: border-box;
          width: 100%;
          padding: 11px;
          border-radius: 10px;
          border: 1px solid #303033;
          background: #09090a;
          color: white;
          outline: none;
        }

        .field textarea {
          min-height: 78px;
          resize: vertical;
        }

        .primary {
          width: 100%;
          border: 0;
          border-radius: 10px;
          padding: 12px;
          background: #f4f4f4;
          color: #0a0a0b;
          font-weight: 800;
          cursor: pointer;
        }

        .category-list {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 14px;
        }

        .category-pill {
          border: 1px solid #303033;
          border-radius: 999px;
          padding: 7px 10px;
          color: #aaa;
          font-size: 12px;
        }

        .menu-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .item-card {
          overflow: hidden;
        }

        .item-image,
        .image-placeholder {
          width: 100%;
          aspect-ratio: 4 / 3;
          display: block;
        }

        .item-image {
          object-fit: cover;
          background: #18181a;
        }

        .image-placeholder {
          display: grid;
          place-items: center;
          color: #666;
          background: #18181a;
        }

        .item-body {
          padding: 16px;
        }

        .item-name {
          font-size: 18px;
          font-weight: 800;
        }

        .item-category {
          color: #888;
          font-size: 12px;
          margin-top: 4px;
        }

        .price {
          margin-top: 14px;
          font-size: 18px;
          font-weight: 800;
        }

        .description {
          margin-top: 8px;
          min-height: 38px;
          color: #999;
          font-size: 13px;
          line-height: 1.5;
        }

        .availability {
          display: inline-block;
          margin-top: 12px;
          border: 1px solid #303033;
          border-radius: 999px;
          padding: 6px 9px;
          font-size: 11px;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .available {
          color: #ddd;
        }

        .unavailable {
          color: #777;
        }

        details {
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px solid #29292b;
        }

        summary {
          cursor: pointer;
          color: #ccc;
          font-size: 13px;
        }

        .edit-form {
          margin-top: 14px;
        }

        .secondary {
          border: 1px solid #303033;
          background: transparent;
          color: white;
          border-radius: 9px;
          padding: 10px 12px;
          cursor: pointer;
        }

        .delete {
          width: 100%;
          margin-top: 8px;
          color: #aaa;
        }

        .empty {
          padding: 50px 20px;
          text-align: center;
          color: #888;
          border: 1px dashed #2b2b2d;
          border-radius: 14px;
        }

        @media (max-width: 1000px) {
          .layout {
            grid-template-columns: 1fr;
          }

          .menu-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 620px) {
          .menu-page {
            padding: 16px;
          }

          .menu-topbar {
            flex-direction: column;
          }

          .menu-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="menu-wrap">
        <header className="menu-topbar">
          <div>
            <span className="brand-mark">ADDIS RMS</span>
            <p className="eyebrow" style={{ marginTop: 22 }}>
              MENU MANAGEMENT
            </p>
            <h1>{restaurant?.name || "Restaurant"}</h1>
            <p className="subtle">
              {roles[membership.role] || membership.role} access · Food and drink catalog.
            </p>
          </div>

          <div className="menu-actions">
            {canManage && <a className="menu-cta" href="#menu-item-form">Add menu item</a>}
            <Link href="/" className="back-link">← Overview</Link>
          </div>
        </header>

        <MenuFilters
          totalItems={menuItems.length}
          categories={[
            ...categoryList.map((category) => ({
            id: category.id,
            name: category.name,
            count: menuItems.filter((item) => item.category_id === category.id).length,
            })),
            ...(menuItems.some((item) => !item.category_id)
              ? [{ id: "UNCATEGORIZED", name: "Uncategorized", count: menuItems.filter((item) => !item.category_id).length }]
              : []),
          ]}
        />

        <div className="layout">
          {canManage && (
            <aside>
              <section className="panel" id="menu-item-form">
                <p className="eyebrow">CATEGORY</p>
                <h2>Add category</h2>

                <form action={createCategory}>
                  <div className="field">
                    <label htmlFor="category-name">Category name</label>
                    <input
                      id="category-name"
                      name="name"
                      placeholder="Main Dishes"
                      required
                    />
                  </div>

                  <button className="primary" type="submit">
                    Add category
                  </button>
                </form>

                <div className="category-list">
                  {categoryList.map((category) => (
                    <span className="category-pill" key={category.id}>
                      {category.name}
                    </span>
                  ))}
                </div>
              </section>

              <section className="panel">
                <p className="eyebrow">MENU ITEM</p>
                <h2>Add food or drink</h2>

                <form action={createMenuItem}>
                  <div className="field">
                    <label htmlFor="item-name">Name</label>
                    <input
                      id="item-name"
                      name="name"
                      placeholder="Doro Wot"
                      required
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="category_id">Category</label>
                    <select id="category_id" name="category_id">
                      <option value="">Uncategorized</option>
                      {categoryList.map((category) => (
                        <option value={category.id} key={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="item-price">Price (ETB)</label>
                    <input
                      id="item-price"
                      name="price"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="350"
                      required
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="item-station">Preparation station</label>
                    <select id="item-station" name="station" defaultValue="KITCHEN">
                      <option value="KITCHEN">Kitchen</option>
                      <option value="BAR">Bar</option>
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="description">Description</label>
                    <textarea
                      id="description"
                      name="description"
                      placeholder="Traditional Ethiopian chicken stew"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="image">Photo — JPG / JPEG only</label>
                    <input
                      id="image"
                      name="image"
                      type="file"
                      accept=".jpg,.jpeg,image/jpeg"
                    />
                  </div>

                  <button className="primary" type="submit">
                    Add menu item
                  </button>
                </form>
              </section>
            </aside>
          )}

          <section>
            <div className="menu-grid">
              {menuItems.length === 0 ? (
                <div className="empty">
                  No menu items yet.
                  {canManage
                    ? " Add your first food or drink from the setup panel."
                    : ""}
                </div>
              ) : (
                menuItems.map((item) => (
                  <article
                    className="item-card"
                    key={item.id}
                    data-menu-item
                    data-name={item.name.toLowerCase()}
                    data-category={item.category_id || "UNCATEGORIZED"}
                  >
                    {item.image_url ? (
                      <img
                        className="item-image"
                        src={item.image_url}
                        alt={item.name}
                      />
                    ) : (
                      <div className="image-placeholder">NO IMAGE</div>
                    )}

                    <div className="item-body">
                      <div className="item-name">{item.name}</div>

                      <div className="item-category">
                        {categoryMap[item.category_id] || "Uncategorized"}
                      </div>

                      <div className="price">
                        {formatETB(item.price)}
                      </div>

                      <div className="description">
                        {item.description || "No description added."}
                      </div>

                      <span
                        className={`availability ${
                          item.is_available ? "available" : "unavailable"
                        }`}
                      >
                        {item.is_available ? "Available" : "Unavailable"}
                      </span>

                      {canManage && (
                        <>
                          <details>
                            <summary>Edit menu item</summary>

                            <form
                              className="edit-form"
                              action={updateMenuItem}
                            >
                              <input
                                type="hidden"
                                name="id"
                                value={item.id}
                              />

                              <div className="field">
                                <label>Name</label>
                                <input
                                  name="name"
                                  defaultValue={item.name}
                                  required
                                />
                              </div>

                              <div className="field">
                                <label>Category</label>
                                <select
                                  name="category_id"
                                  defaultValue={item.category_id || ""}
                                >
                                  <option value="">
                                    Uncategorized
                                  </option>
                                  {categoryList.map((category) => (
                                    <option
                                      value={category.id}
                                      key={category.id}
                                    >
                                      {category.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="field">
                                <label>Price (ETB)</label>
                                <input
                                  name="price"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  defaultValue={item.price}
                                  required
                                />
                              </div>

                              <div className="field">
                                <label>Preparation station</label>
                                <select name="station" defaultValue={item.station || "KITCHEN"}>
                                  <option value="KITCHEN">Kitchen</option>
                                  <option value="BAR">Bar</option>
                                </select>
                              </div>

                              <div className="field">
                                <label>Description</label>
                                <textarea
                                  name="description"
                                  defaultValue={item.description || ""}
                                />
                              </div>

                              <div className="field">
                                <label>Replace photo — JPG/JPEG</label>
                                <input
                                  name="image"
                                  type="file"
                                  accept=".jpg,.jpeg,image/jpeg"
                                />
                              </div>

                              <div className="field">
                                <label>Availability</label>
                                <select
                                  name="is_available"
                                  defaultValue={
                                    item.is_available ? "true" : "false"
                                  }
                                >
                                  <option value="true">Available</option>
                                  <option value="false">Unavailable</option>
                                </select>
                              </div>

                              <button className="primary" type="submit">
                                Save changes
                              </button>
                            </form>
                          </details>

                          <form
                            action={deleteMenuItem}
                          >
                            <input
                              type="hidden"
                              name="id"
                              value={item.id}
                            />
                            <button
                              className="secondary delete"
                              type="submit"
                            >
                              Delete item
                            </button>
                          </form>
                        </>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
