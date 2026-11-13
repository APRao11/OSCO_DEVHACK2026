import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  UploadCloud,
  FileCheck2,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input, SearchInput } from '../ui/Input';
import { Card, CardHeader, CardContent, CardFooter } from '../ui/Card';
import { MetricStat } from '../ui/MetricStat';

export const DesignSystemShowcase: React.FC = () => {
  const [demoInput, setDemoInput] = useState('');
  const [demoSearch, setDemoSearch] = useState('');
  const [demoErrorInput, setDemoErrorInput] = useState('Invalid-Dose-Syntax');

  const palette = [
    {
      name: 'Primary Dark Forest',
      hex: '#173B3A',
      role: 'Core brandmark, primary buttons, headers, prominent sidebar',
      bgClass: 'bg-[#173B3A]',
      textClass: 'text-white',
    },
    {
      name: 'Main Background',
      hex: '#F0F4F2',
      role: 'App-level body background, high contrast against cards',
      bgClass: 'bg-[#F0F4F2]',
      textClass: 'text-[#192B2A]',
      border: true,
    },
    {
      name: 'Card Background',
      hex: '#FFFFFF',
      role: 'Card containers, table rows, elevated workspaces',
      bgClass: 'bg-[#FFFFFF]',
      textClass: 'text-[#192B2A]',
      border: true,
    },
    {
      name: 'Secondary Eucalyptus',
      hex: '#6E9991',
      role: 'Secondary actions, borders, subtle badges, active indicators',
      bgClass: 'bg-[#6E9991]',
      textClass: 'text-white',
    },
    {
      name: 'Accent Citron',
      hex: '#C7D957',
      role: 'High-value highlights, verified badges, active focus pips',
      bgClass: 'bg-[#C7D957]',
      textClass: 'text-[#173B3A]',
    },
    {
      name: 'Warning / Contradiction',
      hex: '#B65D4B',
      role: 'Contradiction detection, discrepancy alerts, safety flags',
      bgClass: 'bg-[#B65D4B]',
      textClass: 'text-white',
    },
    {
      name: 'Main Text',
      hex: '#192B2A',
      role: 'Headings, primary body labels, highest readability',
      bgClass: 'bg-[#192B2A]',
      textClass: 'text-white',
    },
    {
      name: 'Secondary Text',
      hex: '#71817E',
      role: 'Subtitles, descriptive guidance, timestamps, secondary captions',
      bgClass: 'bg-[#71817E]',
      textClass: 'text-white',
    },
    {
      name: 'Borders',
      hex: '#DCE5E1',
      role: 'Dividers, card outlines, subtle structural grid lines',
      bgClass: 'bg-[#DCE5E1]',
      textClass: 'text-[#192B2A]',
      border: true,
    },
  ];

  return (
    <div className="space-y-12">
      {/* Specimen Intro */}
      <section className="border-b border-border-subtle pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase bg-forest text-white px-2 py-0.5 rounded font-semibold tracking-wider">
              DESIGN SPECIFICATION
            </span>
            <span className="text-xs font-mono text-text-secondary">OSCO SYSTEM v1.0</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold font-heading text-forest tracking-tight">
            Design Tokens & Layout Foundation
          </h1>
          <p className="text-sm sm:text-base text-text-secondary max-w-3xl leading-relaxed">
            The design language balances high-density clinical information with editorial
            modernity. Thin borders (#DCE5E1), restrained shadows, strong typographic hierarchy
            (Sora + Instrument Sans + IBM Plex Mono), and purposeful citron (#C7D957) highlights.
          </p>
        </div>
      </section>

      {/* 1. Exact Color Palette */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold font-heading text-forest">1. Strict Color Palette</h2>
          <span className="text-xs font-mono text-text-secondary">9 Defined System Tokens</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {palette.map((item, idx) => (
            <div
              key={idx}
              className="border border-border-subtle rounded-lg bg-white overflow-hidden shadow-xs"
            >
              <div
                className={`h-20 ${item.bgClass} flex items-end p-3 ${
                  item.border ? 'border-b border-border-subtle' : ''
                }`}
              >
                <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-black/20 ${item.textClass}`}>
                  {item.hex}
                </span>
              </div>
              <div className="p-3.5 space-y-1">
                <div className="font-heading font-semibold text-sm text-text-main">
                  {item.name}
                </div>
                <div className="text-xs text-text-secondary leading-snug">{item.role}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Typography Hierarchy */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold font-heading text-forest">2. Typography System</h2>
          <span className="text-xs font-mono text-text-secondary">
            Sora • Instrument Sans • IBM Plex Mono
          </span>
        </div>

        <Card>
          <CardContent className="space-y-6">
            <div className="border-b border-border-subtle pb-5">
              <span className="text-[11px] font-mono text-text-muted uppercase block mb-1">
                Headings: Sora (SemiBold / Bold / Tight Tracking)
              </span>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold font-heading text-forest">
                  H1. Medical History Reconstruction & Provenance Engine
                </h1>
                <h2 className="text-2xl font-semibold font-heading text-forest">
                  H2. Longitudinal Encounter Ledger & Timeline Verification
                </h2>
                <h3 className="text-xl font-semibold font-heading text-text-main">
                  H3. Cross-Document Contradiction Analysis
                </h3>
                <h4 className="text-base font-semibold font-heading text-text-main">
                  H4. Laboratory Diagnostic Parameter (HbA1c & eGFR)
                </h4>
              </div>
            </div>

            <div className="border-b border-border-subtle pb-5">
              <span className="text-[11px] font-mono text-text-muted uppercase block mb-1">
                Body: Instrument Sans (Regular / Medium / Crisp Contrast)
              </span>
              <div className="space-y-2 max-w-3xl text-text-main">
                <p className="text-base font-body leading-relaxed">
                  <strong>Body Large:</strong> Clinical events are synthesized from disparate,
                  unstructured hospital records, discharge summaries, and laboratory test archives
                  with zero hallucination guarantees.
                </p>
                <p className="text-sm font-body text-text-secondary leading-relaxed">
                  <strong>Body Regular:</strong> Every extracted entity preserves a two-way
                  cryptographic back-reference to the exact line number, page offset, and hospital
                  authenticator signature.
                </p>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-mono text-text-muted uppercase block mb-1">
                Metadata, Dates & IDs: IBM Plex Mono
              </span>
              <div className="flex flex-wrap gap-3">
                <span className="font-mono text-xs bg-osco-bg px-2.5 py-1 rounded border border-border-subtle text-forest font-semibold">
                  MRN: #940-281-K
                </span>
                <span className="font-mono text-xs bg-osco-bg px-2.5 py-1 rounded border border-border-subtle text-text-main">
                  ISO-DATE: 2026-11-13T02:30:00Z
                </span>
                <span className="font-mono text-xs bg-osco-bg px-2.5 py-1 rounded border border-border-subtle text-text-muted">
                  HASH: 7f83b165...e2d3
                </span>
                <span className="font-mono text-xs bg-[#F4F8D8] px-2.5 py-1 rounded border border-[#C7D957] text-forest font-semibold">
                  CONFIDENCE: 98.4%
                </span>
                <span className="font-mono text-xs bg-warning-subtle px-2.5 py-1 rounded border border-warning/30 text-warning font-semibold">
                  FLAG: DISCREPANCY-DETECTED
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 3. Reusable Buttons */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold font-heading text-forest">3. Button Variants & States</h2>
          <span className="text-xs font-mono text-text-secondary">Precision Clickables</span>
        </div>

        <Card>
          <CardContent className="space-y-6">
            <div>
              <h4 className="text-xs font-mono uppercase text-text-muted mb-3">
                Variants (Size: MD)
              </h4>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" leftIcon={<ShieldCheck size={15} />}>
                  Primary Forest
                </Button>
                <Button variant="secondary" leftIcon={<UploadCloud size={15} />}>
                  Secondary Eucalyptus
                </Button>
                <Button variant="outline">Outline Neutral</Button>
                <Button variant="citron" leftIcon={<FileCheck2 size={15} />}>
                  Citron Highlight
                </Button>
                <Button variant="warning" leftIcon={<AlertTriangle size={15} />}>
                  Warning Action
                </Button>
                <Button variant="ghost">Ghost Button</Button>
              </div>
            </div>

            <div className="border-t border-border-subtle pt-4">
              <h4 className="text-xs font-mono uppercase text-text-muted mb-3">
                Sizes & Interactive States
              </h4>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm" variant="primary">
                  Small (sm)
                </Button>
                <Button size="md" variant="primary">
                  Medium (md)
                </Button>
                <Button size="lg" variant="primary">
                  Large (lg)
                </Button>
                <Button size="md" variant="primary" isLoading>
                  Loading State
                </Button>
                <Button size="md" variant="primary" disabled>
                  Disabled
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 4. Badges & Status Indicators */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold font-heading text-forest">4. Clinical Badges & Status</h2>
          <span className="text-xs font-mono text-text-secondary">Contextual Verification</span>
        </div>

        <Card>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="verified" dot isMono>
                IDENTITY VERIFIED
              </Badge>
              <Badge variant="citron" dot isMono>
                98.4% CONFIDENCE
              </Badge>
              <Badge variant="forest" isMono>
                RECON-LOCKED
              </Badge>
              <Badge variant="secondary">Pharmacotherapy</Badge>
              <Badge variant="warning" dot isMono>
                CONTRADICTION #C-409
              </Badge>
              <Badge variant="neutral" dot isMono>
                SYNC NOMINAL
              </Badge>
              <Badge variant="outline">FHIR Observation</Badge>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 5. Inputs & Form Controls */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold font-heading text-forest">5. Form Inputs & Search</h2>
          <span className="text-xs font-mono text-text-secondary">Crisp 1px Boundaries</span>
        </div>

        <Card>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Patient Full Name"
                placeholder="e.g. Elena Vance"
                value={demoInput}
                onChange={(e) => setDemoInput(e.target.value)}
                helperText="Must match primary government-issued ID records"
              />

              <Input
                label="Medical Record Number"
                prefixText="MRN:"
                placeholder="940-281-K"
                isMono
                helperText="National clinical identifier format"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-main mb-1.5 uppercase tracking-wider">
                  Global Clinical Search
                </label>
                <SearchInput
                  value={demoSearch}
                  onChange={setDemoSearch}
                  placeholder="Filter by ICD-10, medication, clinic..."
                />
              </div>

              <Input
                label="Dosage Verification"
                value={demoErrorInput}
                onChange={(e) => setDemoErrorInput(e.target.value)}
                error="Dosage format unrecognized by RxNorm ontology"
                isMono
              />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 6. Asymmetric Editorial Cards */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold font-heading text-forest">
            6. Editorial Cards & Metric Stats
          </h2>
          <span className="text-xs font-mono text-text-secondary">Non-Uniform Asymmetric Grid</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <Card accent="forest">
              <CardHeader
                title="Cryptographic Timeline Ledger"
                subtitle="All clinical events are timestamped and signed with SHA-256 provenance hashes"
                badge={
                  <Badge variant="verified" size="sm" isMono>
                    100% PROVENANCE
                  </Badge>
                }
                action={
                  <Button variant="outline" size="sm">
                    View Ledger
                  </Button>
                }
              />
              <CardContent>
                <p className="text-sm text-text-secondary leading-relaxed mb-4">
                  Unlike traditional EHR tables that flatten history, OSCO reconstructs the true
                  causal timeline of patient diagnoses, medication adjustments, and contradictory
                  clinical entries across institutional silos.
                </p>
                <div className="p-3 bg-osco-bg rounded border border-border-subtle font-mono text-xs text-text-main">
                  ROOT HASH: 0x8a91c49b...3182 • PREVIOUS BLOCK: 0x2e11a9 • VERIFIED BY 4 PEERS
                </div>
              </CardContent>
              <CardFooter>
                <span>Last consistency sweep: 2 minutes ago</span>
                <span className="font-mono text-forest font-semibold">Zero Desync Detected</span>
              </CardFooter>
            </Card>
          </div>

          <div className="lg:col-span-4 space-y-4">
            <MetricStat
              label="Extraction Fidelity"
              value="99.2%"
              code="EHR-EXTRACT"
              trend="14 Hospital Docs Verified"
              trendVariant="verified"
              highlightCitron={true}
            />
            <MetricStat
              label="Contradiction Guard"
              value="Active"
              code="GUARD-v2"
              trend="Continuous Cross-Check"
              trendVariant="citron"
            />
          </div>
        </div>
      </section>
    </div>
  );
};
