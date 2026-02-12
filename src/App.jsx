import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

function App() {
  const [step, setStep] = useState('home');
  const [chatTab, setChatTab] = useState('sohbet');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [showFilter, setShowFilter] = useState(false);
  const [minAge, setMinAge] = useState(13);
  const [maxAge, setMaxAge] = useState(65);
  const [filterMale, setFilterMale] = useState(true);
  const [filterFemale, setFilterFemale] = useState(true);

  // Kayıt state'leri
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regGender, setRegGender] = useState('');
  const [regBirthDate, setRegBirthDate] = useState('');
  const [regBio, setRegBio] = useState('');

  // Giriş state'leri
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Düzenleme state'leri
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');

  // Sahte kullanıcılar (test için)
  const [users] = useState([
    { id: 1, username: 'Gamer1', gender: 'erkek', age: 25, bio: 'Valorant tutkunu, duo arıyorum' },
    { id: 2, username: 'ProPlayer', gender: 'kadın', age: 22, bio: 'CS2 rank grind' },
    { id: 3, username: 'NoobMaster', gender: 'erkek', age: 19, bio: 'Yeni başlıyorum' },
    { id: 4, username: 'QueenBee', gender: 'kadın', age: 24, bio: 'LoL main' },
  ]);

  const filteredUsers = users.filter(user => {
    const ageMatch = user.age >= minAge && user.age <= maxAge;
    const genderMatch = 
      (filterMale && user.gender === 'erkek') ||
      (filterFemale && user.gender === 'kadın');
    return ageMatch && genderMatch;
  });

  // Oturum kontrolü (sayfa yenilendiğinde giriş kalsın)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => {
            if (data) {
              setLoggedInUser(data);
              setEditUsername(data.username || '');
              setEditBio(data.bio || '');
              setStep('dashboard');
            }
          });
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        setLoggedInUser(profile);
        setStep('dashboard');
      } else {
        setLoggedInUser(null);
        setStep('home');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!regUsername || !regEmail || !regPassword || !regConfirmPassword || !regGender || !regBirthDate) {
      setErrorMessage('Lütfen tüm alanları doldur! Doğum tarihi zorunludur.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Şifreler eşleşmiyor!');
      return;
    }

    const birthYear = new Date(regBirthDate).getFullYear();
    const age = new Date().getFullYear() - birthYear;
    if (age < 13) {
      setErrorMessage('13 yaşından küçükler kayıt olamaz!');
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: regEmail,
        password: regPassword,
        options: {
          data: {
            username: regUsername,
            gender: regGender,
            birth_date: regBirthDate,
            bio: regBio || '',
            age: age
          }
        }
      });

      if (error) throw error;

      setSuccessMessage('Kayıt başarılı! E-postanı kontrol et ve doğrulama linkine tıkla.');
      setTimeout(() => setStep('login'), 4000);
    } catch (error) {
      setErrorMessage(error.message || 'Kayıt sırasında hata oluştu');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) throw error;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError) throw profileError;

      setLoggedInUser(profile);
      setSuccessMessage('Giriş başarılı!');
      setTimeout(() => setStep('dashboard'), 2000);
    } catch (error) {
      setErrorMessage(error.message || 'Giriş başarısız');
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !loggedInUser) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `\( {loggedInUser.id}. \){fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', loggedInUser.id);

      if (updateError) throw updateError;

      setLoggedInUser({ ...loggedInUser, avatar_url: publicUrl });
      setSuccessMessage('Profil fotoğrafı güncellendi!');
    } catch (error) {
      setErrorMessage('Fotoğraf yüklenemedi: ' + error.message);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!loggedInUser) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username: editUsername,
          bio: editBio,
        })
        .eq('id', loggedInUser.id);

      if (error) throw error;

      setLoggedInUser({
        ...loggedInUser,
        username: editUsername,
        bio: editBio,
      });
      setSuccessMessage('Profil güncellendi!');
      setStep('profile');
    } catch (error) {
      setErrorMessage('Profil güncellenemedi: ' + error.message);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0f0f1a',
      color: 'white',
      fontFamily: 'Arial, sans-serif',
      position: 'relative'
    }}>
      {/* Sol üst NurtiDuo */}
      {(step !== 'home' && step !== 'login' && step !== 'register') && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          fontSize: '1.8rem',
          fontWeight: 'bold',
          color: 'white',
          textShadow: '0 0 8px #a855f7, 0 0 16px #a855f7, 0 0 32px #a855f7',
          zIndex: 100,
          pointerEvents: 'none'
        }}>
          NurtiDuo
        </div>
      )}

      {/* Ana ekran */}
      {step === 'home' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <h1 style={{
            fontSize: '3.8rem',
            fontWeight: 'bold',
            marginBottom: '60px',
            color: 'white',
            textShadow: '0 0 12px #a855f7, 0 0 24px #a855f7, 0 0 48px #a855f7, 0 0 72px #a855f7'
          }}>
            NurtiDuo
          </h1>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', width: '100%', maxWidth: '380px', alignItems: 'center' }}>
            <button onClick={() => setStep('login')} style={{ backgroundColor: '#0f0f1a', color: 'white', fontSize: '1.35rem', fontWeight: 'bold', padding: '14px 32px', border: '2px solid #22c55e', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 0 12px rgba(34, 197, 94, 0.3)', whiteSpace: 'nowrap' }}>
              Giriş Yap
            </button>
            <button onClick={() => setStep('register')} style={{ backgroundColor: '#0f0f1a', color: 'white', fontSize: '1.35rem', fontWeight: 'bold', padding: '14px 32px', border: '2px solid #22c55e', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 0 12px rgba(34, 197, 94, 0.3)', whiteSpace: 'nowrap' }}>
              Kayıt Ol
            </button>
            <p style={{ marginTop: '90px', color: '#9ca3af', fontSize: '1.1rem', fontWeight: '500' }}>
              Hoşgeldin kankam
            </p>
          </div>
        </div>
      )}

      {/* Giriş Ekranı */}
      {step === 'login' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <h1 style={{
            fontSize: '3.8rem',
            fontWeight: 'bold',
            marginBottom: '40px',
            color: 'white',
            textShadow: '0 0 12px #a855f7, 0 0 24px #a855f7, 0 0 48px #a855f7, 0 0 72px #a855f7'
          }}>
            NurtiDuo
          </h1>

          <h2 style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '20px', color: '#22c55e' }}>
            Giriş Yap
          </h2>
          <form style={{ width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <input type="email" placeholder="E-posta" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} style={{ padding: '14px', fontSize: '1.1rem', backgroundColor: '#1e1e2e', border: '2px solid #22c55e', borderRadius: '8px', color: 'white', outline: 'none' }} />
            <input type="password" placeholder="Şifre" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} style={{ padding: '14px', fontSize: '1.1rem', backgroundColor: '#1e1e2e', border: '2px solid #22c55e', borderRadius: '8px', color: 'white', outline: 'none' }} />
            <button type="submit" onClick={handleLogin} style={{ padding: '14px', fontSize: '1.3rem', fontWeight: 'bold', backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s' }}>
              Giriş Yap
            </button>
            {errorMessage && (
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#f87171', fontSize: '0.95rem', marginBottom: '4px' }}>{errorMessage}</p>
                <p style={{ color: '#22c55e', fontSize: '0.95rem', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => alert('Şifre sıfırlama henüz yapılmadı')}>Şifremi unuttum?</p>
              </div>
            )}
            <p style={{ textAlign: 'center', marginTop: '20px', color: '#9ca3af' }}>
              Hesabın yok mu? <span style={{ color: '#22c55e', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setStep('register')}>Kayıt Ol</span>
            </p>
          </form>
        </div>
      )}

      {/* Kayıt Ekranı */}
      {step === 'register' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', overflow: 'auto' }}>
          <h1 style={{
            fontSize: '3.8rem',
            fontWeight: 'bold',
            marginBottom: '40px',
            color: 'white',
            textShadow: '0 0 12px #a855f7, 0 0 24px #a855f7, 0 0 48px #a855f7, 0 0 72px #a855f7'
          }}>
            NurtiDuo
          </h1>

          <h2 style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '20px', color: '#22c55e' }}>
            Kayıt Ol
          </h2>
          <form style={{ width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <input type="text" placeholder="Kullanıcı adı / Takma ad" value={regUsername} onChange={(e) => setRegUsername(e.target.value)} style={{ padding: '14px', fontSize: '1.1rem', backgroundColor: '#1e1e2e', border: '2px solid #22c55e', borderRadius: '8px', color: 'white', outline: 'none' }} />
            <input type="email" placeholder="E-posta adresi" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} style={{ padding: '14px', fontSize: '1.1rem', backgroundColor: '#1e1e2e', border: '2px solid #22c55e', borderRadius: '8px', color: 'white', outline: 'none' }} />
            <select value={regGender} onChange={(e) => setRegGender(e.target.value)} style={{ padding: '14px', fontSize: '1.1rem', backgroundColor: '#1e1e2e', border: '2px solid #22c55e', borderRadius: '8px', color: 'white', outline: 'none' }}>
              <option value="" disabled>Cinsiyet seç</option>
              <option value="erkek">Erkek</option>
              <option value="kadın">Kadın</option>
              <option value="diğer">Diğer</option>
            </select>
            <input type="date" value={regBirthDate} onChange={(e) => setRegBirthDate(e.target.value)} required style={{ padding: '14px', fontSize: '1.1rem', backgroundColor: '#1e1e2e', border: '2px solid #22c55e', borderRadius: '8px', color: 'white', outline: 'none' }} />
            <input type="password" placeholder="Şifre" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} style={{ padding: '14px', fontSize: '1.1rem', backgroundColor: '#1e1e2e', border: '2px solid #22c55e', borderRadius: '8px', color: 'white', outline: 'none' }} />
            <input type="password" placeholder="Şifre tekrarı" value={regConfirmPassword} onChange={(e) => setRegConfirmPassword(e.target.value)} style={{ padding: '14px', fontSize: '1.1rem', backgroundColor: '#1e1e2e', border: '2px solid #22c55e', borderRadius: '8px', color: 'white', outline: 'none' }} />
            <p style={{ fontSize: '0.9rem', color: '#9ca3af', textAlign: 'center', margin: '12px 0 4px 0', lineHeight: '1.4' }}>
              Cinsiyet ve yaş değiştirilemez bilgileri doğru girelim
            </p>
            <button type="submit" onClick={handleRegister} style={{ padding: '14px', fontSize: '1.3rem', fontWeight: 'bold', backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s' }}>
              Kayıt Ol
            </button>
            <p style={{ textAlign: 'center', marginTop: '20px', color: '#9ca3af' }}>
              Zaten hesabın var mı? <span style={{ color: '#22c55e', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setStep('login')}>Giriş Yap</span>
            </p>
          </form>
        </div>
      )}

      {/* Dashboard */}
      {step === 'dashboard' && (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', paddingTop: '70px' }}>
          <div style={{ flex: 1, padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '40px', gap: '20px' }}>
              <button style={{
                flex: 1,
                height: '160px',
                backgroundColor: '#1a1a2e',
                border: '2px solid #a855f7',
                borderRadius: '16px',
                cursor: 'pointer',
                boxShadow: '0 0 16px rgba(168, 85, 247, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="70" height="70" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 15V5C21 3.89543 20.1046 3 19 3H5C3.89543 3 3 3.89543 3 5V15C3 16.1046 3.89543 17 5 17H8L12 21L16 17H19C20.1046 17 21 16.1046 21 15Z" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="drop-shadow(0 0 8px #a855f7)" />
                  <path d="M8 10H16" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="drop-shadow(0 0 8px #a855f7)" />
                  <path d="M8 14H12" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="drop-shadow(0 0 8px #a855f7)" />
                </svg>
              </button>

              <button style={{
                flex: 1,
                height: '160px',
                backgroundColor: '#1a1a2e',
                border: '2px solid #a855f7',
                borderRadius: '16px',
                cursor: 'pointer',
                boxShadow: '0 0 16px rgba(168, 85, 247, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="70" height="70" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 15C14.2091 15 16 13.2091 16 11V5C16 2.79086 14.2091 1 12 1C9.79086 1 8 2.79086 8 5V11C8 13.2091 9.79086 15 12 15Z" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="drop-shadow(0 0 8px #a855f7)" />
                  <path d="M19 11C19 14.866 15.866 18 12 18C8.13401 18 5 14.866 5 11" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="drop-shadow(0 0 8px #a855f7)" />
                  <path d="M12 18V21" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="drop-shadow(0 0 8px #a855f7)" />
                </svg>
              </button>
            </div>

            <div style={{ textAlign: 'right', marginBottom: '20px' }}>
              <button onClick={() => setShowFilter(true)} style={{ backgroundColor: '#1e1e2e', color: 'white', padding: '10px 20px', border: '2px solid #a855f7', borderRadius: '10px', cursor: 'pointer' }}>
                Filtre
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredUsers.map(user => (
                <div key={user.id} style={{ backgroundColor: '#1e1e2e', padding: '12px', borderRadius: '8px', cursor: 'pointer' }}>
                  <p style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: '0' }}>
                    {user.username} <span style={{ color: user.gender === 'kadın' ? '#f472b6' : '#60a5fa' }}>{user.age}</span>
                  </p>
                  <p style={{ fontSize: '0.9rem', color: '#d1d5db', margin: '4px 0 0 0' }}>{user.bio}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Alt navigasyon */}
          <div style={{
            height: '70px',
            backgroundColor: '#1a1a2e',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            borderTop: '1px solid #a855f7',
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 50
          }}>
            <button onClick={() => setStep('dashboard')} style={{ background: 'none', border: 'none', padding: '12px', cursor: 'pointer' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 9L12 2L21 9V20C21 21.1 20.1 22 19 22H5C3.9 22 3 21.1 3 20V9Z" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="drop-shadow(0 0 8px #a855f7)" />
                <path d="M9 22V12H15V22" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="drop-shadow(0 0 8px #a855f7)" />
              </svg>
            </button>

            <button onClick={() => setStep('discover')} style={{ background: 'none', border: 'none', padding: '12px', cursor: 'pointer' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="drop-shadow(0 0 8px #a855f7)" />
              </svg>
            </button>

            <button onClick={() => setStep('chat')} style={{ background: 'none', border: 'none', padding: '12px', cursor: 'pointer' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 11.5C21 16.75 16.97 21 12 21C10.5 21 9.07 20.66 7.8 20L3 21L4.5 17.5C3.5 16 3 14.3 3 12.5C3 7.25 7.03 3 12 3C16.97 3 21 7.25 21 11.5Z" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="drop-shadow(0 0 8px #a855f7)" />
              </svg>
            </button>

            <button onClick={() => setStep('profile')} style={{ background: 'none', border: 'none', padding: '12px', cursor: 'pointer' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="drop-shadow(0 0 8px #a855f7)" />
                <path d="M6 22V20C6 16.6863 8.68629 14 12 14C15.3137 14 18 16.6863 18 20V22" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="drop-shadow(0 0 8px #a855f7)" />
              </svg>
            </button>
          </div>

          {/* Filtre Paneli */}
          {showFilter && (
            <div style={{
              position: 'fixed',
              bottom: '90px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '90%',
              maxWidth: '400px',
              backgroundColor: '#1c1c30',
              border: '2px solid #a855f7',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
              zIndex: 200
            }}>
              <h3 style={{ textAlign: 'center', marginBottom: '24px', color: '#a855f7' }}>Filtre Ayarları</h3>

              {/* Minimum Yaş */}
              <div style={{ marginBottom: '28px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#d1d5db' }}>
                  Minimum Yaş: {minAge}
                </label>
                <input
                  type="range"
                  min="13"
                  max="65"
                  value={minAge}
                  onChange={(e) => {
                    const newMin = Number(e.target.value);
                    setMinAge(newMin);
                    if (newMin > maxAge) setMaxAge(newMin);
                  }}
                  style={{ width: '100%', accentColor: '#a855f7' }}
                />
              </div>

              {/* Maksimum Yaş */}
              <div style={{ marginBottom: '28px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#d1d5db' }}>
                  Maksimum Yaş: {maxAge}
                </label>
                <input
                  type="range"
                  min="13"
                  max="65"
                  value={maxAge}
                  onChange={(e) => {
                    const newMax = Number(e.target.value);
                    setMaxAge(newMax);
                    if (newMax < minAge) setMinAge(newMax);
                  }}
                  style={{ width: '100%', accentColor: '#a855f7' }}
                />
              </div>

              {/* Cinsiyet */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#d1d5db' }}>
                  <input
                    type="checkbox"
                    checked={filterMale}
                    onChange={(e) => setFilterMale(e.target.checked)}
                    style={{ accentColor: '#60a5fa', width: '18px', height: '18px' }}
                  />
                  Erkek
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#d1d5db' }}>
                  <input
                    type="checkbox"
                    checked={filterFemale}
                    onChange={(e) => setFilterFemale(e.target.checked)}
                    style={{ accentColor: '#f472b6', width: '18px', height: '18px' }}
                  />
                  Kadın
                </label>
              </div>

              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                <button onClick={() => setShowFilter(false)} style={{ padding: '10px 24px', backgroundColor: '#991b1b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                  Kapat
                </button>
                <button onClick={() => setShowFilter(false)} style={{ padding: '10px 24px', backgroundColor: '#a855f7', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                  Uygula
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Profil Düzenleme Ekranı */}
      {step === 'editProfile' && (
        <div style={{ minHeight: '100vh', padding: '20px', backgroundColor: '#0f0f1a' }}>
          <h2 style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '30px', color: '#a855f7' }}>
            Profili Düzenle
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', maxWidth: '380px', margin: '0 auto' }}>
            {/* Profil fotoğrafı */}
            <div style={{ textAlign: 'center' }}>
              {loggedInUser?.avatar_url ? (
                <img
                  src={loggedInUser.avatar_url}
                  alt="Profil Fotoğrafı"
                  style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #a855f7' }}
                />
              ) : (
                <div style={{ width: '120px', height: '120px', borderRadius: '50%', backgroundColor: '#1e1e2e', border: '3px solid #a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  Fotoğraf Yok
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                style={{ marginTop: '12px', color: 'white' }}
              />
            </div>

            {/* Kullanıcı adı */}
            <div style={{ width: '100%' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#d1d5db' }}>Kullanıcı Adı</label>
              <input
                type="text"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                style={{ width: '100%', padding: '12px', backgroundColor: '#1e1e2e', border: '2px solid #a855f7', borderRadius: '8px', color: 'white' }}
              />
            </div>

            {/* Hakkında */}
            <div style={{ width: '100%' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#d1d5db' }}>Hakkında</label>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                rows="4"
                style={{ width: '100%', padding: '12px', backgroundColor: '#1e1e2e', border: '2px solid #a855f7', borderRadius: '8px', color: 'white', resize: 'vertical' }}
              />
            </div>

            {/* Kaydet butonu */}
            <button
              onClick={handleSaveProfile}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: '#a855f7',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '1.2rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Kaydet
            </button>

            {/* Geri dön */}
            <button
              onClick={() => setStep('profile')}
              style={{ marginTop: '16px', color: '#a855f7', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Geri Dön
            </button>
          </div>

          {/* Alt navigasyon */}
          <div style={{
            height: '70px',
            backgroundColor: '#1a1a2e',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            borderTop: '1px solid #a855f7',
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 50
          }}>
            <button onClick={() => setStep('dashboard')} style={{ background: 'none', border: 'none', padding: '12px', cursor: 'pointer' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 9L12 2L21 9V20C21 21.1 20.1 22 19 22H5C3.9 22 3 21.1 3 20V9Z" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="drop-shadow(0 0 8px #a855f7)" />
                <path d="M9 22V12H15V22" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="drop-shadow(0 0 8px #a855f7)" />
              </svg>
            </button>

            <button onClick={() => setStep('discover')} style={{ background: 'none', border: 'none', padding: '12px', cursor: 'pointer' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="drop-shadow(0 0 8px #a855f7)" />
              </svg>
            </button>

            <button onClick={() => setStep('chat')} style={{ background: 'none', border: 'none', padding: '12px', cursor: 'pointer' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 11.5C21 16.75 16.97 21 12 21C10.5 21 9.07 20.66 7.8 20L3 21L4.5 17.5C3.5 16 3 14.3 3 12.5C3 7.25 7.03 3 12 3C16.97 3 21 7.25 21 11.5Z" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="drop-shadow(0 0 8px #a855f7)" />
              </svg>
            </button>

            <button onClick={() => setStep('profile')} style={{ background: 'none', border: 'none', padding: '12px', cursor: 'pointer' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="drop-shadow(0 0 8px #a855f7)" />
                <path d="M6 22V20C6 16.6863 8.68629 14 12 14C15.3137 14 18 16.6863 18 20V22" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="drop-shadow(0 0 8px #a855f7)" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Bildirimler */}
      {successMessage && (
        <div style={{ position: 'fixed', bottom: '90px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#166534', color: 'white', padding: '14px 32px', borderRadius: '10px', boxShadow: '0 6px 20px rgba(0,0,0,0.6)', zIndex: 1000, minWidth: '280px', textAlign: 'center' }}>
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div style={{ position: 'fixed', bottom: '90px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#991b1b', color: 'white', padding: '12px 28px', borderRadius: '10px', boxShadow: '0 6px 20px rgba(0,0,0,0.6)', zIndex: 1000, maxWidth: '90%', textAlign: 'center' }}>
          {errorMessage}
        </div>
      )}
    </div>
  );
}

export default App;
