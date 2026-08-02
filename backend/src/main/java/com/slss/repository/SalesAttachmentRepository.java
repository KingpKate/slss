package com.slss.repository;
import com.slss.domain.SalesAttachment; import org.springframework.data.jpa.repository.JpaRepository; import java.util.List;
public interface SalesAttachmentRepository extends JpaRepository<SalesAttachment,Long>{List<SalesAttachment> findByInitiation_IdOrderByCreatedAtDesc(Long id);}
