export default function Home() {
  return (
    <main style={{
      backgroundColor: '#000',
      color: '#fff',
      minHeight: '100vh',
      fontFamily: 'sans-serif',
    }}>

      {/* Navbar */}
      <nav style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 40px',
        borderBottom: '1px solid #111',
      }}>
        <h1 style={{
          color: '#4FC3F7',
          fontSize: '24px',
          fontWeight: 'bold',
          letterSpacing: '2px',
        }}>NEXA</h1>
        <button style={{
          backgroundColor: '#4FC3F7',
          color: '#000',
          border: 'none',
          padding: '10px 24px',
          borderRadius: '6px',
          fontWeight: 'bold',
          cursor: 'pointer',
        }}>Get Started</button>
      </nav>

      {/* Hero Section */}
      <section style={{
        textAlign: 'center',
        padding: '100px 20px 60px',
      }}>
        <p style={{
          color: '#4FC3F7',
          letterSpacing: '4px',
          fontSize: '13px',
          marginBottom: '20px',
          textTransform: 'uppercase',
        }}>The Global AI Agent Platform</p>

        <h2 style={{
          fontSize: '52px',
          fontWeight: 'bold',
          lineHeight: '1.2',
          marginBottom: '24px',
        }}>
          AI That Talks.<br />
          <span style={{ color: '#4FC3F7' }}>AI That Acts.</span>
        </h2>

        <p style={{
          color: '#aaa',
          fontSize: '18px',
          maxWidth: '600px',
          margin: '0 auto 40px',
          lineHeight: '1.7',
        }}>
          Nexa helps businesses solve real problems with intelligent AI agents
          that communicate, understand, and take action.
        </p>

        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button style={{
            backgroundColor: '#4FC3F7',
            color: '#000',
            border: 'none',
            padding: '14px 32px',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}>Start Building</button>

          <button style={{
            backgroundColor: 'transparent',
            color: '#fff',
            border: '1px solid #333',
            padding: '14px 32px',
            borderRadius: '8px',
            fontSize: '16px',
            cursor: 'pointer',
          }}>Explore Nexa</button>
        </div>
      </section>

      {/* Three Pillars */}
      <section style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '24px',
        padding: '60px 40px',
        flexWrap: 'wrap',
      }}>

        {[
          {
            title: 'Communicate',
            desc: 'AI that understands conversations across modern business channels.',
          },
          {
            title: 'Understand',
            desc: 'AI that understands customer needs, business context, and intent.',
          },
          {
            title: 'Act',
            desc: 'AI that takes useful actions and helps solve real business problems.',
          },
        ].map((item) => (
          <div key={item.title} style={{
            backgroundColor: '#0a0a0a',
            border: '1px solid #1a1a1a',
            borderRadius: '12px',
            padding: '32px',
            width: '280px',
            transition: 'border-color 0.3s',
          }}>
            <h3 style={{
              color: '#4FC3F7',
              fontSize: '20px',
              marginBottom: '12px',
              fontWeight: 'bold',
            }}>{item.title}</h3>
            <p style={{
              color: '#888',
              lineHeight: '1.6',
              fontSize: '15px',
            }}>{item.desc}</p>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '30px',
        color: '#444',
        borderTop: '1px solid #111',
        fontSize: '13px',
      }}>
        © 2025 Nexa. All rights reserved.
      </footer>

    </main>
  );
}