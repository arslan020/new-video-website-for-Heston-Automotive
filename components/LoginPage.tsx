'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, verify2FA } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (step === 1) {
        const data = await login(username, password);
        if (data.requireTwoFactor) {
          setUserId(data.userId!);
          setStep(2);
          setLoading(false);
          return;
        }
        router.push(data.role === 'admin' ? '/admin' : '/staff');
      } else {
        const data = await verify2FA(userId!, otp);
        router.push(data.role === 'admin' ? '/admin' : '/staff');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid credentials');
      setLoading(false);
    }
  };

  return (
    <div className="loginPage">
      <div className="loginWrap">
        <div className="loginLogo">
          <Image src="/business-logo.png" alt="Heston Automotive" width={280} height={80} style={{ height: 'auto' }} />
        </div>

        <h2 className="loginHeading">
          {step === 1 ? 'Sign In To Your' : 'Verify Your'}<br />
          {step === 1 ? 'Account' : 'Identity'}
        </h2>

        <form onSubmit={handleSubmit} className="loginForm">
          {error && <div className="loginError">{error}</div>}

          {step === 1 ? (
            <>
              <div className="inputGroup">
                <input
                  type="text"
                  placeholder="Username or Email"
                  className="inputMinimal"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="inputGroup">
                <input
                  type="password"
                  placeholder="Password"
                  className="inputMinimal"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </>
          ) : (
            <div className="inputGroup">
              <p className="otpInfoText">
                Please enter the verification code sent to your email.
              </p>
              <input
                type="text"
                placeholder="Enter 6-digit code"
                className="inputMinimal otpInput"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (step === 1 ? (!username || !password) : otp.length !== 6)}
            className="btnMinimal"
          >
            {loading ? 'Processing...' : (step === 1 ? 'Login' : 'Verify Code')}
          </button>

          {step === 2 && (
            <button
              type="button"
              onClick={() => { setStep(1); setError(''); }}
              className="backBtn"
            >
              Back to Login
            </button>
          )}
        </form>

        {step === 1 && (
          <div className="loginLinks">
            <Link href="/forgot-password">Forgotten password?</Link>
          </div>
        )}

        <div className="loginWatermark">
          <div className="markDot" />
          <p className="markName">Heston Automotive</p>
          <p className="markCopy">© 2025</p>
        </div>
      </div>
    </div>
  );
}
