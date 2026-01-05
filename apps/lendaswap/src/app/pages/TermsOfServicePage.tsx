import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "#/components/ui/button";

export function TermsOfServicePage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(-1)}
        className="mb-6 gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-muted-foreground mb-8">Last updated: January 2025</p>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
          <p className="text-muted-foreground leading-relaxed">
            These Terms of Service ("Terms") govern your use of LendaSwap, an
            atomic swap service operated by Sofbear Consulting Ltd., a company
            registered in the British Virgin Islands ("Company", "we", "us", or
            "our"). By accessing or using our service, you agree to be bound by
            these Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">2. Service Description</h2>
          <p className="text-muted-foreground leading-relaxed">
            LendaSwap provides an atomic swap service that enables users to
            exchange Bitcoin (BTC) with Wrapped Bitcoin (wBTC) and other tokens
            across multiple blockchain networks, including but not limited to
            Ethereum and Polygon.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-3">
            When a user wishes to acquire BTC using tokens on Ethereum, Polygon,
            or other supported networks, the deposited funds are first converted
            to wBTC through decentralized exchanges (such as Uniswap), and then
            atomically swapped to BTC, which is sent to the user's specified
            target address.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">3. Refund Policy</h2>
          <p className="text-muted-foreground leading-relaxed">
            In the event that a swap cannot be completed or requires a refund,
            users will receive their initial deposited asset back to their
            original address. For swaps initiated from Ethereum, Polygon, or
            other EVM-compatible networks to BTC, please note that:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
            <li>Refunds will be processed in the original asset deposited</li>
            <li>Refunds will be sent to the original source address</li>
            <li>
              Users may be subject to exchange rate fluctuations between the
              time of deposit and refund
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">4. Exchange Rate Risk</h2>
          <p className="text-muted-foreground leading-relaxed">
            <strong className="text-foreground">IMPORTANT:</strong> Users
            participating in swaps from EVM-compatible networks (Ethereum,
            Polygon, etc.) to BTC are subject to exchange rate risk. We use
            decentralized exchanges, including Uniswap, to convert tokens to
            wBTC as part of the swap process.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-3">
            We do not provide any guarantees regarding exchange rates. Rates may
            fluctuate between the time you initiate a swap and when it is
            executed. You acknowledge and accept this risk when using our
            service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">5. No Warranties</h2>
          <p className="text-muted-foreground leading-relaxed">
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT ANY
            WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. TO THE FULLEST EXTENT
            PERMITTED BY APPLICABLE LAW, WE DISCLAIM ALL WARRANTIES, INCLUDING
            BUT NOT LIMITED TO:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
            <li>
              Warranties of merchantability or fitness for a particular purpose
            </li>
            <li>
              Warranties regarding the accuracy, reliability, or completeness of
              the service
            </li>
            <li>
              Warranties that the service will be uninterrupted, secure, or
              error-free
            </li>
            <li>
              Warranties regarding exchange rates, transaction timing, or
              execution
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">
            6. Limitation of Liability
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, SOFBEAR CONSULTING LTD. AND
            ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE
            FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
            DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR
            OTHER INTANGIBLE LOSSES, ARISING OUT OF OR RELATED TO YOUR USE OF
            THE SERVICE.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-3">
            This includes, without limitation, any losses resulting from:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
            <li>Exchange rate fluctuations</li>
            <li>Failed or delayed transactions</li>
            <li>Network congestion or blockchain issues</li>
            <li>Smart contract vulnerabilities</li>
            <li>
              Third-party service failures (including decentralized exchanges)
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">
            7. User Responsibilities
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            By using our service, you acknowledge and agree that:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
            <li>
              You are solely responsible for securing your private keys and
              recovery phrases
            </li>
            <li>
              You understand the risks associated with cryptocurrency
              transactions
            </li>
            <li>
              You will verify all transaction details before confirming any swap
            </li>
            <li>
              You comply with all applicable laws and regulations in your
              jurisdiction
            </li>
            <li>
              You are not using the service for any illegal or prohibited
              purposes
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">
            8. Third-Party Services
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Our service integrates with third-party protocols and services,
            including but not limited to Uniswap, various blockchain networks,
            and wallet providers. We are not responsible for the performance,
            availability, or security of these third-party services.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">
            9. Modifications to Terms
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            We reserve the right to modify these Terms at any time. Changes will
            be effective immediately upon posting to our website. Your continued
            use of the service after any changes constitutes acceptance of the
            modified Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">10. Governing Law</h2>
          <p className="text-muted-foreground leading-relaxed">
            These Terms shall be governed by and construed in accordance with
            the laws of the British Virgin Islands, without regard to its
            conflict of law provisions.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">11. Contact</h2>
          <p className="text-muted-foreground leading-relaxed">
            For questions about these Terms, please contact us through our
            official channels.
          </p>
          <p className="text-muted-foreground mt-2">
            <strong className="text-foreground">Sofbear Consulting Ltd.</strong>
            <br />
            British Virgin Islands
          </p>
        </section>
      </div>
    </div>
  );
}
