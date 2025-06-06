import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

// Props: poolState has .nftReserve (BN), .tokenReserve (BN), .vx, .vy
export default function PriceChart({
  poolState,
}: {
  poolState: {
    nftReserve: any;
    tokenReserve: any;
    vx: any;
    vy: any;
  };
}) {
  // Convert BNs → numbers
  const nftRes   = poolState.nftReserve.toNumber();
  const tokenRes = poolState.tokenReserve.toNumber();
  const vx       = poolState.vx.toNumber();
  const vy       = poolState.vy.toNumber();

  // constant-product k
  const k = (nftRes + vx) * (tokenRes + vy);

  // build data points: for NFT supply = 1..nftRes+vx
  const maxSupply = nftRes + vx + 5; // show a few beyond current
  const data = Array.from({ length: maxSupply - 1 }, (_, i) => {
    const xTotal = i + 1 + vx;
    // price to BUY 1 more NFT = Δy = k/(xTotal-1) - k/(xTotal)
    const priceBase = k / (xTotal - 1) - k / xTotal;
    const price = priceBase / 1e9; // convert base units → WOODENG
    return { nfts: i + 1, price: parseFloat(price.toFixed(2)) };
  });

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <CartesianGrid stroke="#444" strokeDasharray="3 3" />
        <XAxis dataKey="nfts" label={{ value: "NFTs in Pool", position: "insideBottom" }} />
        <YAxis label={{ value: "Price (WOODENG)", angle: -90, position: "insideLeft" }} />
        <Tooltip />
        <Line type="monotone" dataKey="price" stroke="#82ca9d" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
