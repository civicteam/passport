import { PlatformSpec, PlatformGroupSpec, Provider } from "../types";
import { BrightIdProvider } from "./Providers/brightid";

export const PlatformDetails: PlatformSpec = {
  icon: "./assets/brightidStampIcon.svg",
  platform: "Brightid",
  name: "BrightID",
  description: "Connect to BrightID to verify your identity on Web3 without revealing any personal information.",
  connectMessage: "Connect Account",
  isEVM: true,
  website: "https://brightid.org/",
};

export const ProviderConfig: PlatformGroupSpec[] = [
  {
    platformGroup: "Account Name",
    providers: [{ title: "Encrypted", name: "Brightid" }],
  },
];

export const providers: Provider[] = [new BrightIdProvider()];
