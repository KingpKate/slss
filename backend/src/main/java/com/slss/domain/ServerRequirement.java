package com.slss.domain;
import jakarta.persistence.*;
@Entity @Table(name="sales_server_requirements") public class ServerRequirement {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="initiation_id",nullable=false) private SalesInitiation initiation;
 @Column(name="server_model") private String serverModel; @Column(nullable=false) private int quantity;
 @Column(name="cpu_requirement",columnDefinition="TEXT") private String cpuRequirement;
 @Column(name="memory_requirement",columnDefinition="TEXT") private String memoryRequirement;
 @Column(name="storage_requirement",columnDefinition="TEXT") private String storageRequirement;
 @Column(name="network_requirement",columnDefinition="TEXT") private String networkRequirement;
 @Column(name="custom_description",columnDefinition="TEXT") private String customDescription;
 public Long getId(){return id;} public Long getInitiationId(){return initiation.getId();} public String getServerModel(){return serverModel;} public int getQuantity(){return quantity;} public String getCpuRequirement(){return cpuRequirement;} public String getMemoryRequirement(){return memoryRequirement;} public String getStorageRequirement(){return storageRequirement;} public String getNetworkRequirement(){return networkRequirement;} public String getCustomDescription(){return customDescription;} public void setInitiation(SalesInitiation v){initiation=v;} public void setServerModel(String v){serverModel=v;} public void setQuantity(int v){quantity=v;} public void setCpuRequirement(String v){cpuRequirement=v;} public void setMemoryRequirement(String v){memoryRequirement=v;} public void setStorageRequirement(String v){storageRequirement=v;} public void setNetworkRequirement(String v){networkRequirement=v;} public void setCustomDescription(String v){customDescription=v;}
}
