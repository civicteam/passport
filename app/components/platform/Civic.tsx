import {PlatformSpec} from "@gitcoin/passport-platforms";
import React, {FC, useEffect} from "react";
import {PlatformGroupCardProps} from "./index";
import {GatewayProvider, GatewayStatus, IdentityButton, useGateway} from "@civic/ethereum-gateway-react";
import {useConnectWallet} from "@web3-onboard/react";
import {JsonRpcSigner, Web3Provider} from "@ethersproject/providers";
import {Wallet} from "@ethersproject/wallet";

type CivicPassType = "CivicCaptchaPass" | "CivicUniquenessPass" | "CivicLivenessPass" | "CivicIDVPass";

const passTypeToUrl = (passType: CivicPassType) => {
    const pass = passType.toLowerCase().replace("civic", "").replace("pass", "");
    return `https://demopass.civic.com?pass=${pass}`;
};

const SmallIdentityButtonContents: FC<{gatewayStatus: GatewayStatus, handleClick: () => void}> = ({gatewayStatus, handleClick}) => {
    switch (gatewayStatus) {
        case GatewayStatus.ACTIVE:
            return (
                <>
                    <img alt="completed icon" className="sticky top-0 h-4" src="./assets/check-icon.svg"/>
                    Pass Active
                </>
            );
        case GatewayStatus.REFRESH_TOKEN_REQUIRED:
            return (
                <button onClick={handleClick} className="flex">
                    <img alt="Platform Image" src="./assets/civicStampIcon.svg" className="m-1 h-4 w-4"/>
                    Refresh Pass
                </button>
            );
        case GatewayStatus.ERROR:
            return (
                <button onClick={handleClick} className="flex">
                    <img alt="Platform Image" src="./assets/verification-failed.svg" className="m-1 h-4 w-4"/>
                    Error occurred - retry
                </button>
            );
        case GatewayStatus.NOT_REQUESTED:
        default:
            return (
                <button onClick={handleClick} className="flex">
                    <img alt="Platform Image" src="./assets/civicStampIcon.svg" className="m-1 h-4 w-4"/>
                    Request Pass
                </button>
            );
    }
};

const SmallIdentityButton:FC = () => {
    const { gatewayStatus, requestGatewayToken } = useGateway();

    const handleClick = () => {
        requestGatewayToken().catch(console.error);
    };

    return <div className="flex items-center justify-center">
        <SmallIdentityButtonContents gatewayStatus={gatewayStatus} handleClick={handleClick}/>
    </div>;
}

const passTypeToKey = (passType: CivicPassType) => {
    switch (passType) {
        case "CivicCaptchaPass": return "ignREusXmGrscGNUesoU9mxfds9AiYTezUKex2PsZV6";
        case "CivicUniquenessPass": return "uniqobk8oGh4XBLMqM68K8M2zNu3CdYX7q5go7whQiv";
        case "CivicLivenessPass": return "vaa1QRNEBb1G2XjPohqGWnPsvxWnwwXF67pdjrhDSwM";
        case "CivicIDVPass": return "bni1ewus6aMxTxBi5SAfzEmmXLf8KcVFRmTfproJuKw";
    }
};

interface EthersV5Wallet extends JsonRpcSigner {
    address: string,
}

export const PlatformGroupCard = ({ platformGroup, platform }: PlatformGroupCardProps) => {
    const [{ wallet, connecting }, connect, disconnect] = useConnectWallet()
    const [ethersWallet, setEthersWallet] = React.useState<EthersV5Wallet>()

    useEffect(() => {
        if (wallet && wallet.accounts.length > 0) {
            // if using ethers v6 this is:
            const ethersProvider = new Web3Provider(wallet.provider, 'any')
            const signer = ethersProvider.getSigner();
            const ethersCompatibleWallet: EthersV5Wallet = Object.assign(signer, {address: wallet.accounts[0].address});
            setEthersWallet(ethersCompatibleWallet);
        }
    }, [wallet]);

    return (
        <div className="inline-flex">
            <GatewayProvider wallet={ethersWallet as (Wallet | undefined)} gatekeeperNetwork={passTypeToKey(platformGroup.providers[0].name as CivicPassType)} options={{autoShowModal: false}}>
                <SmallIdentityButton/>
            </GatewayProvider>
        </div>
    );
};

export const PlatformCard = ({ platform }: { platform: PlatformSpec }) => {
    return <div>{platform.name}</div>;
};
