import { useContext, useState } from "react";
import { toast } from "react-toastify";
import { AuthContext } from "../../contexts/AuthContext";
import { updateUserById } from "../../api/auth";

function Profile() {
  const { user, updateUser } = useContext(AuthContext);
  const [form, setForm] = useState({ name: user?.name || "", phone: user?.phone || "", address: user?.address || "", bio: user?.bio || "" });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await updateUserById(user._id, form);
      updateUser(res.data.data.user);
      toast.success("Profile updated!");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-narrow">
      <div className="page-header"><h1>My profile</h1></div>

      <form className="form-card stack" onSubmit={handleSubmit}>
        <div className="field">
          <label>Name</label>
          <input className="input" name="name" value={form.name} onChange={handleChange} />
        </div>
        <div className="field">
          <label>Email</label>
          <input className="input" value={user?.email || ""} disabled />
        </div>
        <div className="field">
          <label>Phone</label>
          <input className="input" name="phone" value={form.phone} onChange={handleChange} />
        </div>
        <div className="field">
          <label>Address</label>
          <input className="input" name="address" value={form.address} onChange={handleChange} />
        </div>
        <div className="field">
          <label>Bio</label>
          <textarea className="input" name="bio" value={form.bio} onChange={handleChange} placeholder="A short note about yourself" />
        </div>
        <button className="btn btn-block" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button>
      </form>
    </div>
  );
}

export default Profile;
