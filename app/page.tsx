/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

'use client';

import React, { useEffect, useState, FormEvent } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection } from '@solana/web3.js';
import { Metaplex, walletAdapterIdentity } from '@metaplex-foundation/js';

// Your QuickNode RPC endpoint
const MAINNET_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT ||
  'https://misty-smart-panorama.solana-mainnet.quiknode.pro/8bec11e1812457246ec8670f36ef6f54924fc725';

export default function HomePage() {
  const { publicKey } = useWallet();
  const [nfts, setNfts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Handle password submission
  const handlePasswordSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (password === 'ilovewoodeng') {
      setAuthorized(true);
      setError('');
    } else {
      setError('Incorrect password. Please try again.');
    }
  };

  useEffect(() => {
    if (!authorized) return;
    if (!publicKey) {
      setNfts([]);
      return;
    }

    const fetchNFTs = async () => {
      setLoading(true);
      try {
        const connection = new Connection(MAINNET_RPC, 'confirmed');
        const metaplex = new Metaplex(connection).use(walletAdapterIdentity({ publicKey }));
        const userNfts = await metaplex.nfts().findAllByOwner({ owner: publicKey });

        console.log(
          'Wallet NFT mint addresses:',
          userNfts.map((nft: any) => {
            try {
              return nft.mintAddress?.toBase58();
            } catch (e) {
              return 'unknown';
            }
          })
        );

        // Load full metadata for each NFT
        const loadedNfts = await Promise.all(
          userNfts.map(async (nft: any) => {
            try {
              return await metaplex.nfts().load({ metadata: nft });
            } catch (error) {
              console.error('Error loading NFT metadata:', error);
              return null;
            }
          })
        );
        setNfts(loadedNfts.filter((nft) => nft !== null));
      } catch (error) {
        console.error('Error fetching NFTs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNFTs();
  }, [authorized, publicKey]);

  if (!authorized) {
    return (
      <main style={mainStyle}>
        <div style={loginContainerStyle}>
          <h2 style={titleStyle}>Enter Password</h2>
          <form onSubmit={handlePasswordSubmit}>
            <input
              type="text"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
            <button type="submit" style={buttonStyle}>Submit</button>
          </form>
          {error && <p style={errorStyle}>{error}</p>}
        </div>
      </main>
    );
  }

  return (
    <main style={mainStyle}>
      {!publicKey && <p>Please connect your wallet to access your music library.</p>}
      {publicKey && (
        <div style={containerStyle}>
          <h2 style={titleStyle}>Your Library</h2>
          {loading && <p>Loading your tracks...</p>}
          {!loading && nfts.length === 0 && <p>No tracks found in your library.</p>}
          <div style={libraryContainerFlexStyle}>
            {nfts.map((nft, idx) => (
              <NftCard key={idx} nft={nft} />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function NftCard({ nft }: { nft: any }) {
  const [metadata, setMetadata] = useState<any>(null);
  const [flipped, setFlipped] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (nft?.json) {
      setMetadata(nft.json);
    }
  }, [nft]);

  if (!metadata) {
    return <div style={cardStyle}>Loading...</div>;
  }

  const rarity =
    (metadata.attributes &&
      metadata.attributes.find((attr: any) => attr.trait_type.toLowerCase() === 'rarity')?.value.toLowerCase()) ||
    'common';

  const rarityColors: { [key: string]: string } = {
    common: '#9e9e9e',
    uncommon: '#4caf50',
    rare: '#2196f3',
    epic: '#9c27b0',
    legendary: '#ff9800',
  };

  const cardContainerStyle = {
    ...flipCardContainerStyle,
    borderRadius: '16px',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    transform: hovered ? 'scale(1.05)' : 'scale(1)',
    boxShadow: hovered ? `0 8px 16px 0 ${rarityColors[rarity] || '#fff'}` : 'none'
  };

  const imageUrl = metadata.image || '/default-nft.png';
  const trackTitle = metadata.name || 'Untitled';
  const playLink = metadata.musicDownloadLink || metadata.animation_url || null;
  const artist =
    (metadata.attributes &&
      metadata.attributes.find((attr: any) => attr.trait_type === 'Artist')?.value) ||
    'Unknown Artist';
  const description = metadata.description || 'No description available.';
  const genre =
    (metadata.attributes &&
      metadata.attributes.find((attr: any) => attr.trait_type === 'Genre')?.value) ||
    '';
  const album =
    (metadata.attributes &&
      metadata.attributes.find((attr: any) => attr.trait_type === 'Album')?.value) ||
    '';
  const collection = (metadata.collection && metadata.collection.name) || '';

  const handleCardClick = () => {
    setFlipped(!flipped);
  };

  return (
    <div
      style={cardContainerStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleCardClick}
    >
      <div style={{ ...flipCardInnerStyle, transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
        {/* Front Side */}
        <div style={flipCardFrontStyle}>
          <img src={imageUrl} alt={trackTitle} style={imageStyle} />
          <div style={frontInfoStyle}>
            <h3 style={trackTitleStyle}>{trackTitle}</h3>
            <p style={artistStyle}>{artist}</p>
          </div>
          <div style={detailsIconStyle}>ℹ️</div>
          {playLink && (
            <a
              href={playLink}
              download
              style={playButtonStyle}
              onClick={(e) => e.stopPropagation()}
            >
              Play Track
            </a>
          )}
        </div>
        {/* Back Side */}
        <div style={flipCardBackStyle}>
          <div style={backHeaderStyle}>
            <div style={backGenreStyle}><strong>Genre:</strong> {genre}</div>
            <div style={backAlbumStyle}><strong>Album:</strong> {album}</div>
          </div>
          <p style={descriptionStyle}>{description}</p>
          <p style={collectionStyle}><strong>Collection:</strong> {collection}</p>
        </div>
      </div>
    </div>
  );
}

// Styling objects

const mainStyle: React.CSSProperties = {
  padding: '20px',
  backgroundColor: '#000',
  color: '#fff',
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center'
};

const loginContainerStyle: React.CSSProperties = {
  backgroundColor: '#1c1c1e',
  padding: '40px',
  borderRadius: '8px',
  textAlign: 'center'
};

const inputStyle: React.CSSProperties = {
  padding: '10px',
  fontSize: '16px',
  borderRadius: '4px',
  border: '1px solid #ccc',
  marginBottom: '20px',
  width: '80%',
  color: '#000',
  backgroundColor: '#fff'
};

const buttonStyle: React.CSSProperties = {
  padding: '10px 20px',
  fontSize: '16px',
  borderRadius: '4px',
  background: 'linear-gradient(90deg, #8b5cf6, #7c3aed)',
  color: '#fff',
  border: 'none',
  cursor: 'pointer'
};

const errorStyle: React.CSSProperties = {
  color: '#ff9800',
  marginTop: '10px'
};

const containerStyle: React.CSSProperties = {
  marginTop: '20px'
};

const libraryContainerFlexStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  gap: '20px',
  flexWrap: 'wrap',
  justifyContent: 'center'
};

const titleStyle: React.CSSProperties = {
  color: '#fff',
  fontSize: '28px',
  fontWeight: 'bold',
  textAlign: 'center',
  marginBottom: '20px'
};

const flipCardContainerStyle: React.CSSProperties = {
  perspective: '1000px',
  cursor: 'pointer',
  width: '240px',
  height: '360px'
};

const flipCardInnerStyle: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  transition: 'transform 0.6s',
  transformStyle: 'preserve-3d'
};

const flipCardFrontStyle: React.CSSProperties = {
  position: 'absolute',
  width: '100%',
  height: '100%',
  backfaceVisibility: 'hidden',
  backgroundColor: '#1c1c1e',
  border: '2px solid #6b21a8',
  borderRadius: '16px',
  padding: '16px',
  boxSizing: 'border-box'
};

const flipCardBackStyle: React.CSSProperties = {
  position: 'absolute',
  width: '100%',
  height: '100%',
  backfaceVisibility: 'hidden',
  backgroundColor: '#1c1c1e',
  border: '2px solid #6b21a8',
  borderRadius: '16px',
  padding: '16px',
  boxSizing: 'border-box',
  transform: 'rotateY(180deg)',
  textAlign: 'center'
};

const cardStyle: React.CSSProperties = {
  width: '240px',
  height: '360px'
};

const imageStyle: React.CSSProperties = {
  width: '100%',
  height: 'auto',
  borderRadius: '12px'
};

const frontInfoStyle: React.CSSProperties = {
  marginTop: '8px'
};

const trackTitleStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0'
};

const artistStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#ddd',
  margin: '4px 0 0 0'
};

const detailsIconStyle: React.CSSProperties = {
  position: 'absolute',
  top: '8px',
  right: '8px',
  fontSize: '20px',
  color: '#fff',
  background: 'rgba(0, 0, 0, 0.6)',
  borderRadius: '50%',
  padding: '4px'
};

const playButtonStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '8px',
  left: '50%',
  transform: 'translateX(-50%)',
  padding: '8px 16px',
  background: 'linear-gradient(90deg, #8b5cf6, #7c3aed)',
  color: '#fff',
  fontWeight: 'bold',
  textDecoration: 'none',
  borderRadius: '8px',
  boxShadow: '0 4px 10px rgba(123, 58, 237, 0.5)',
  transition: 'all 0.3s ease',
  cursor: 'pointer'
};

const backHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: '10px'
};

const backGenreStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#ccc'
};

const backAlbumStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#ccc'
};

const descriptionStyle: React.CSSProperties = {
  fontSize: '14px',
  marginTop: '10px',
  color: '#fff'
};

const collectionStyle: React.CSSProperties = {
  marginTop: '10px',
  fontSize: '12px',
  color: '#ccc'
};
